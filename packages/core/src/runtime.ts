import type { Logger } from 'pino';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_WALLET_CONFIG } from './constants.js';
import { CocoError } from './errors.js';
import { createLLMProvider } from './llm/index.js';
import { createLogger } from './logger.js';
import { InMemorySessionStore } from './memory/index.js';
import type {
  ChatEvent,
  CocoContext,
  CocoPlugin,
  CocoProvider,
  CocoRuntime,
  CocoRuntimeConfig,
  CocoTool,
  LLMMessage,
  LLMToolCall,
  ResolvedCocoRuntimeConfig,
  RuntimeDependencies,
  ToolResult,
  WalletExecutionRequest,
} from './types.js';
import { safeJsonStringify } from './utils/json.js';
import { toJsonSchema } from './utils/schema.js';
import { DefaultWalletExecutor } from './wallet/executor.js';
import { SqliteLimitLedger } from './wallet/ledger.js';

function withWalletDefaults(
  config: CocoRuntimeConfig,
): ResolvedCocoRuntimeConfig {
  const baseLimits = {
    perTxUsd: DEFAULT_WALLET_CONFIG.limits?.perTxUsd ?? 500,
    dailyUsd: DEFAULT_WALLET_CONFIG.limits?.dailyUsd ?? 2000,
    requireConfirmAbove:
      DEFAULT_WALLET_CONFIG.limits?.requireConfirmAbove ?? 100,
  };
  const inputLimits = config.wallet?.limits;

  return {
    ...config,
    wallet: {
      ...DEFAULT_WALLET_CONFIG,
      ...config.wallet,
      limits: {
        perTxUsd: inputLimits?.perTxUsd ?? baseLimits.perTxUsd,
        dailyUsd: inputLimits?.dailyUsd ?? baseLimits.dailyUsd,
        requireConfirmAbove:
          inputLimits?.requireConfirmAbove ?? baseLimits.requireConfirmAbove,
      },
    },
  };
}

function cloneToolCalls(toolCalls: LLMToolCall[]) {
  return toolCalls.map((toolCall) => ({ ...toolCall }));
}

function normalizeError(error: unknown): ToolResult {
  if (error instanceof CocoError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code: 'runtime_error',
    };
  }

  return {
    success: false,
    error: 'Unknown runtime error',
    code: 'runtime_error',
  };
}

async function hydrateContext(
  ctx: CocoContext,
  providers: Map<string, CocoProvider>,
): Promise<void> {
  for (const provider of providers.values()) {
    const data = await provider.get(ctx);
    Object.assign(ctx.metadata, data);
  }
}

export function createRuntime(
  config: CocoRuntimeConfig,
  dependencies: RuntimeDependencies = {},
): CocoRuntime {
  const resolvedConfig = withWalletDefaults(config);
  const logger: Logger = dependencies.logger ?? createLogger();
  const memory = dependencies.memory ?? new InMemorySessionStore();
  const limitLedger = dependencies.limitLedger ?? new SqliteLimitLedger();
  const llm = createLLMProvider(resolvedConfig.llm, dependencies);
  const walletExecutor = new DefaultWalletExecutor(
    resolvedConfig.chain.rpcUrl,
    limitLedger,
    logger,
  );

  const plugins = new Map<string, CocoPlugin>();
  const tools = new Map<string, CocoTool>();
  const providers = new Map<string, CocoProvider>();

  const runtime: CocoRuntime = {
    config: resolvedConfig,
    llm,
    logger,
    memory,
    plugins,
    tools,
    providers,
    limitLedger,
    async registerPlugin(plugin) {
      await plugin.setup(runtime);

      for (const tool of plugin.tools ?? []) {
        tools.set(tool.id, tool);
      }

      for (const provider of plugin.providers ?? []) {
        providers.set(provider.id, provider);
      }

      plugins.set(plugin.id, plugin);
      logger.info({ pluginId: plugin.id }, 'Plugin registered');
    },
    async unregisterPlugin(pluginId) {
      const plugin = plugins.get(pluginId);
      if (!plugin) {
        return;
      }

      for (const tool of plugin.tools ?? []) {
        tools.delete(tool.id);
      }

      for (const provider of plugin.providers ?? []) {
        providers.delete(provider.id);
      }

      await plugin.teardown?.();
      plugins.delete(pluginId);
      logger.info({ pluginId }, 'Plugin unregistered');
    },
    async invokeTool(toolId, ctx, params) {
      await hydrateContext(ctx, providers);
      const tool = tools.get(toolId);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolId}`,
          code: 'tool_not_found',
        };
      }

      try {
        let parsedParams = params;
        if (tool.schema) {
          const result = tool.schema.safeParse(params);
          if (!result.success) {
            return {
              success: false,
              error: `Invalid params: ${result.error.message}`,
              code: 'tool_invalid_params',
            };
          }
          parsedParams = result.data;
        }

        if (tool.validate) {
          const valid = await tool.validate(ctx);
          if (!valid) {
            return {
              success: false,
              error: 'Tool validation failed.',
              code: 'tool_validation_failed',
            };
          }
        }

        return await tool.execute(ctx, parsedParams);
      } catch (error) {
        logger.error({ error, toolId }, 'Tool invocation failed');
        return normalizeError(error);
      }
    },
    async executeTransaction(request: WalletExecutionRequest) {
      try {
        return await walletExecutor.execute(request);
      } catch (error) {
        logger.error(
          { error, toolId: request.toolId },
          'Wallet execution failed',
        );
        return normalizeError(error);
      }
    },
    async getExecutionAddress(ctx: CocoContext) {
      try {
        return await walletExecutor.resolveAddress(ctx);
      } catch (error) {
        logger.error({ error }, 'Failed to resolve execution address');
        return undefined;
      }
    },
    async *chat(ctx: CocoContext, message: string): AsyncGenerator<ChatEvent> {
      await hydrateContext(ctx, providers);
      const session = await memory.getSession(ctx.sessionId);
      ctx.metadata = { ...session.metadata, ...ctx.metadata };

      /* ── Contract address interceptor ──
       * If the user message is (or contains) a contract address, bypass the LLM
       * entirely and call scan.contract directly. This guarantees a TokenTradeCard
       * regardless of model stability. */
      const addressMatch = message.match(/\b(0x[a-fA-F0-9]{40})\b/);
      const scanTool = tools.get('scan.contract');
      if (addressMatch && scanTool) {
        const address = addressMatch[1];
        logger.info({ address }, 'Contract interceptor: bypassing LLM');

        const toolParams = { address };
        yield { type: 'tool_call', toolId: 'scan.contract', params: toolParams };

        const result = await runtime.invokeTool('scan.contract', ctx, toolParams);
        yield { type: 'tool_result', toolId: 'scan.contract', result };

        // Save to session memory
        const interceptMessages: LLMMessage[] = [
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'intercept_scan_0', name: 'scan.contract', arguments: JSON.stringify(toolParams) }],
          },
          {
            role: 'tool',
            toolCallId: 'intercept_scan_0',
            content: safeJsonStringify(result),
          },
        ];
        await memory.appendMessages(ctx.sessionId, interceptMessages);

        yield { type: 'done' };
        return;
      }

      const newMessages: LLMMessage[] = [{ role: 'user', content: message }];
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: resolvedConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        },
        ...session.messages,
        ...newMessages,
      ];

      await memory.mergeMetadata(ctx.sessionId, ctx.metadata);

      for (let i = 0; i < 5; i += 1) {
        try {
          let fullText = '';
          const toolCalls: LLMToolCall[] = [];

          for await (const chunk of llm.chatStream(
            messages,
            runtime.getToolDefinitions(),
          )) {
            if (typeof chunk === 'string') {
              fullText += chunk;
              yield { type: 'text', content: chunk };
            } else {
              toolCalls.push(chunk);
            }
          }

          if (toolCalls.length === 0) {
            if (fullText) {
              newMessages.push({ role: 'assistant', content: fullText });
            }
            await memory.appendMessages(ctx.sessionId, newMessages);
            yield { type: 'done' };
            return;
          }

          const assistantMessage: LLMMessage = {
            role: 'assistant',
            content: fullText,
            toolCalls: cloneToolCalls(toolCalls),
          };
          messages.push(assistantMessage);
          newMessages.push(assistantMessage);

          for (const call of toolCalls) {
            let parsedArgs: unknown = {};
            try {
              parsedArgs = JSON.parse(call.arguments || '{}');
            } catch {
              const errorMessage = 'Tool arguments were not valid JSON.';
              yield {
                type: 'error',
                error: errorMessage,
                code: 'tool_arguments_invalid_json',
              };
              const toolMessage: LLMMessage = {
                role: 'tool',
                toolCallId: call.id,
                content: safeJsonStringify({
                  success: false,
                  error: errorMessage,
                  code: 'tool_arguments_invalid_json',
                }),
              };
              messages.push(toolMessage);
              newMessages.push(toolMessage);
              continue;
            }

            yield { type: 'tool_call', toolId: call.name, params: parsedArgs };
            const result = await runtime.invokeTool(call.name, ctx, parsedArgs);
            yield { type: 'tool_result', toolId: call.name, result };

            const toolMessage: LLMMessage = {
              role: 'tool',
              toolCallId: call.id,
              content: safeJsonStringify(result),
            };
            messages.push(toolMessage);
            newMessages.push(toolMessage);
          }
        } catch (error) {
          const normalized = normalizeError(error);
          yield {
            type: 'error',
            error: normalized.error ?? 'Unknown runtime error',
            code: normalized.code,
          };
          await memory.appendMessages(ctx.sessionId, newMessages);
          return;
        }
      }

      await memory.appendMessages(ctx.sessionId, newMessages);
      yield {
        type: 'error',
        error: 'Tool loop limit exceeded.',
        code: 'tool_loop_limit_exceeded',
      };
      yield { type: 'done' };
    },
    getToolDefinitions() {
      return Array.from(tools.values()).map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.id,
          description: tool.description,
          parameters: toJsonSchema(tool.schema),
        },
      }));
    },
  };

  return runtime;
}
