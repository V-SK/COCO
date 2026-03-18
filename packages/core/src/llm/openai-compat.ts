import { CocoError } from '../errors.js';
import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
  LLMToolDefinition,
} from '../types.js';
import type { ProviderConfig, ProviderDependencies } from './interface.js';

type OpenAIToolCallDelta = {
  index: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

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

function buildHeaders(config: ProviderConfig): HeadersInit {
  return {
    'content-type': 'application/json',
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

function normalizeToolCalls(
  toolCalls?: Array<Record<string, unknown>>,
): LLMToolCall[] | undefined {
  if (!toolCalls) {
    return undefined;
  }

  return toolCalls.map((toolCall, index) => ({
    id: String(toolCall.id ?? `tool_${index}`),
    name: String(
      (toolCall.function as { name?: string } | undefined)?.name ?? '',
    ),
    arguments: String(
      (toolCall.function as { arguments?: string } | undefined)?.arguments ??
        '{}',
    ),
  }));
}

function toOpenAIMessage(message: LLMMessage): Record<string, unknown> {
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: call.arguments,
        },
      })),
    };
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string | LLMToolCall> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const toolCalls = new Map<number, LLMToolCall>();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (!line.startsWith('data:')) {
          continue;
        }
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          for (const toolCall of toolCalls.values()) {
            yield toolCall;
          }
          return;
        }

        const json = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
              tool_calls?: OpenAIToolCallDelta[];
            };
          }>;
        };

        const delta = json.choices?.[0]?.delta;
        if (!delta) {
          continue;
        }

        const text = delta.content || delta.reasoning_content;
        if (text) {
          yield text;
        }

        for (const toolCallDelta of delta.tool_calls ?? []) {
          const existing = toolCalls.get(toolCallDelta.index) ?? {
            id: toolCallDelta.id ?? `tool_${toolCallDelta.index}`,
            name: '',
            arguments: '',
          };

          toolCalls.set(toolCallDelta.index, {
            id: toolCallDelta.id ?? existing.id,
            name: toolCallDelta.function?.name ?? existing.name,
            arguments: `${existing.arguments}${toolCallDelta.function?.arguments ?? ''}`,
          });
        }
      }
    }
  }

  for (const toolCall of toolCalls.values()) {
    yield toolCall;
  }
}


const IMAGE_URL_RE = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(\?\S*)?/i;

function hasImageUrl(messages: LLMMessage[]): boolean {
  return messages.some(
    (m) => m.role === 'user' && IMAGE_URL_RE.test(m.content),
  );
}

function toVisionMessage(message: LLMMessage): Record<string, unknown> {
  if (message.role !== 'user' || !IMAGE_URL_RE.test(message.content)) {
    return toOpenAIMessage(message);
  }
  const parts: Array<Record<string, unknown>> = [];
  const urls = message.content.match(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(\?\S*)?/gi) || [];
  const textOnly = message.content.replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg)(\?\S*)?/gi, '').trim();
  if (textOnly) {
    parts.push({ type: 'text', text: textOnly });
  }
  for (const url of urls) {
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return { role: 'user', content: parts };
}

export class OpenAICompatibleProvider implements LLMProvider {
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
    const isVision = hasImageUrl(messages);
    const model = isVision
      ? this.#config.model.replace(/Qwen2\.5-\d+B-Instruct/, 'Qwen2.5-VL-72B-Instruct')
      : this.#config.model;
    const response = await this.#fetch(
      `${this.#config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: buildHeaders(this.#config),
        body: JSON.stringify({
          model,
          messages: isVision ? messages.map(toVisionMessage) : messages.map(toOpenAIMessage),
          ...(isVision ? {} : { tools, tool_choice: tools?.length ? "auto" : undefined }),
          temperature: this.#config.temperature,
          max_tokens: this.#config.maxTokens,
        }),
      },
    );

    if (!response.ok) {
      throw new CocoError(
        `OpenAI-compatible request failed with status ${response.status}.`,
        'llm_request_failed',
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: 'assistant';
          content?: string;
          tool_calls?: Array<Record<string, unknown>>;
        };
      }>;
    };

    const message = json.choices?.[0]?.message;
    return {
      role: 'assistant',
      content: message?.content ?? '',
      toolCalls: normalizeToolCalls(message?.tool_calls),
    };
  }

  async *chatStream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ): AsyncGenerator<string | LLMToolCall> {
    const isVision = hasImageUrl(messages);
    const model = isVision
      ? this.#config.model.replace(/Qwen2\.5-\d+B-Instruct/, 'Qwen2.5-VL-72B-Instruct')
      : this.#config.model;
    const response = await this.#fetch(
      `${this.#config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: buildHeaders(this.#config),
        body: JSON.stringify({
          model,
          messages: isVision
            ? messages.map(toVisionMessage)
            : messages.map(toOpenAIMessage),
          ...(isVision ? {} : { tools, tool_choice: tools?.length ? 'auto' : undefined }),
          temperature: this.#config.temperature,
          max_tokens: this.#config.maxTokens,
          stream: true,
        }),
      },
    );

    if (!response.ok || !response.body) {
      throw new CocoError(
        `OpenAI-compatible stream failed with status ${response.status}.`,
        'llm_stream_failed',
      );
    }

    yield* parseOpenAIStream(response.body);
  }
}
