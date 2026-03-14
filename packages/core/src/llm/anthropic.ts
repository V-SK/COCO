import { CocoError } from '../errors.js';
import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
  LLMToolDefinition,
} from '../types.js';
import type { ProviderConfig, ProviderDependencies } from './interface.js';

function requireFetch(
  fetchImpl?: typeof globalThis.fetch,
): typeof globalThis.fetch {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (!resolved) {
    throw new CocoError(
      'Fetch API is not available in this runtime.',
      'fetch_unavailable',
    );
  }
  return resolved;
}

function toAnthropicMessages(messages: LLMMessage[]) {
  const payload: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      continue;
    }

    if (message.role === 'tool') {
      payload.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content,
          },
        ],
      });
      continue;
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      payload.push({
        role: 'assistant',
        content: [
          ...(message.content ? [{ type: 'text', text: message.content }] : []),
          ...message.toolCalls.map((toolCall) => ({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: JSON.parse(toolCall.arguments),
          })),
        ],
      });
      continue;
    }

    payload.push({
      role: message.role,
      content: message.content,
    });
  }

  return payload;
}

function toAnthropicTools(tools?: LLMToolDefinition[]) {
  return tools?.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));
}

function splitSystem(messages: LLMMessage[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  return {
    system,
    messages: toAnthropicMessages(messages),
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly model: string;
  readonly #config: ProviderConfig;
  readonly #fetch: typeof globalThis.fetch;

  constructor(config: ProviderConfig, dependencies: ProviderDependencies = {}) {
    this.model = config.model;
    this.#config = config;
    this.#fetch = requireFetch(dependencies.fetchImpl);
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ): Promise<LLMMessage> {
    const payload = splitSystem(messages);
    const response = await this.#fetch(`${this.#config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(this.#config.apiKey ? { 'x-api-key': this.#config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: this.#config.model,
        system: payload.system,
        messages: payload.messages,
        tools: toAnthropicTools(tools),
        max_tokens: this.#config.maxTokens ?? 1024,
        temperature: this.#config.temperature,
      }),
    });

    if (!response.ok) {
      throw new CocoError(
        `Anthropic request failed with status ${response.status}.`,
        'llm_request_failed',
      );
    }

    const json = (await response.json()) as {
      content?: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: unknown }
      >;
    };

    const text =
      json.content
        ?.filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('') ?? '';
    const toolCalls = json.content
      ?.filter((item) => item.type === 'tool_use')
      .map((item) => ({
        id: item.id,
        name: item.name,
        arguments: JSON.stringify(item.input ?? {}),
      }));

    return {
      role: 'assistant',
      content: text,
      toolCalls,
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ): AsyncGenerator<string | LLMToolCall> {
    const result = await this.chat(messages, tools);
    if (result.content) {
      yield result.content;
    }

    for (const toolCall of result.toolCalls ?? []) {
      yield toolCall;
    }
  }
}
