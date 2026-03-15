import { CocoError } from '../errors.js';
import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
  LLMToolDefinition,
} from '../types.js';

interface OllamaConfig {
  baseUrl: string;
  apiKey?: string | undefined;
  model: string;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
}

interface OllamaDependencies {
  fetchImpl?: typeof globalThis.fetch | undefined;
}

export class OllamaProvider implements LLMProvider {
  readonly model: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #apiKey?: string | undefined;
  readonly #maxTokens?: number | undefined;
  readonly #temperature?: number | undefined;

  constructor(config: OllamaConfig, dependencies: OllamaDependencies = {}) {
    this.model = config.model;
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#fetch = dependencies.fetchImpl ?? globalThis.fetch;
    this.#apiKey = config.apiKey;
    this.#maxTokens = config.maxTokens;
    this.#temperature = config.temperature;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ): Promise<LLMMessage> {
    const response = await this.#request(messages, tools, false);
    return toLlmMessage(response.message);
  }

  async *chatStream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ): AsyncGenerator<string | LLMToolCall> {
    const response = await this.#request(messages, tools, true);
    if (!response.stream) {
      const message = toLlmMessage(response.message);
      if (message.content) {
        yield message.content;
      }
      for (const toolCall of message.toolCalls ?? []) {
        yield toolCall;
      }
      return;
    }

    for await (const chunk of readJsonLines(response.stream)) {
      const message = chunk.message ? toLlmMessage(chunk.message) : undefined;
      if (message?.content) {
        yield message.content;
      }
      for (const toolCall of message?.toolCalls ?? []) {
        yield toolCall;
      }
    }
  }

  async #request(
    messages: LLMMessage[],
    tools: LLMToolDefinition[] | undefined,
    stream: boolean,
  ) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.#apiKey) {
      headers.authorization = `Bearer ${this.#apiKey}`;
    }

    const response = await this.#fetch(`${this.#baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        stream,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
          tool_calls: message.toolCalls?.map((toolCall) => ({
            function: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            id: toolCall.id,
            type: 'function',
          })),
        })),
        tools: tools?.map((tool) => ({
          type: tool.type,
          function: tool.function,
        })),
        options: {
          num_predict: this.#maxTokens,
          temperature: this.#temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new CocoError(
        `Ollama request failed with status ${response.status}.`,
        'ollama_request_failed',
      );
    }

    if (stream) {
      if (!response.body) {
        throw new CocoError(
          'Ollama stream body is missing.',
          'ollama_stream_missing',
        );
      }
      return { stream: response.body };
    }

    return await response.json();
  }
}

function toLlmMessage(payload: {
  content?: string;
  role?: string;
  tool_calls?: Array<{
    function?: { name?: string; arguments?: string | Record<string, unknown> };
    id?: string;
  }>;
}) {
  return {
    role: payload.role === 'assistant' ? 'assistant' : 'assistant',
    content: payload.content ?? '',
    toolCalls: payload.tool_calls?.map((toolCall, index) => ({
      id: toolCall.id ?? `ollama-tool-${index}`,
      name: toolCall.function?.name ?? 'unknown',
      arguments:
        typeof toolCall.function?.arguments === 'string'
          ? toolCall.function.arguments
          : JSON.stringify(toolCall.function?.arguments ?? {}),
    })),
  } satisfies LLMMessage;
}

async function* readJsonLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      yield JSON.parse(trimmed) as {
        message?: {
          content?: string;
          role?: string;
          tool_calls?: Array<{
            function?: {
              name?: string;
              arguments?: string | Record<string, unknown>;
            };
            id?: string;
          }>;
        };
      };
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    yield JSON.parse(trailing) as {
      message?: {
        content?: string;
        role?: string;
        tool_calls?: Array<{
          function?: {
            name?: string;
            arguments?: string | Record<string, unknown>;
          };
          id?: string;
        }>;
      };
    };
  }
}
