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

/**
 * Regex to match Hermes-style `<tool_call>...</tool_call>` blocks emitted by
 * some models (e.g. Qwen 2.5) that bypass the standard OpenAI function-calling
 * wire format and instead output tool invocations as plain text.
 */
const HERMES_TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

/**
 * Try to parse Hermes-style tool calls out of accumulated text.
 * Returns parsed `LLMToolCall[]` (may be empty) and the remaining text with
 * all `<tool_call>` blocks stripped.
 */
function parseHermesToolCalls(text: string): {
  parsedCalls: LLMToolCall[];
  remainingText: string;
} {
  const parsedCalls: LLMToolCall[] = [];
  let idx = 0;

  for (const match of text.matchAll(HERMES_TOOL_CALL_RE)) {
    try {
      const raw = JSON.parse(match[1]) as Record<string, unknown>;

      // Support both flat `{ name, arguments }` and OpenAI-style
      // `{ function: { name, arguments } }` wrappers.
      let name: string;
      let args: string;

      if (raw.function && typeof raw.function === 'object') {
        const fn = raw.function as { name?: string; arguments?: unknown };
        name = String(fn.name ?? '');
        args =
          typeof fn.arguments === 'string'
            ? fn.arguments
            : JSON.stringify(fn.arguments ?? {});
      } else {
        name = String(raw.name ?? '');
        args =
          typeof raw.arguments === 'string'
            ? raw.arguments
            : JSON.stringify(raw.arguments ?? {});
      }

      if (name) {
        parsedCalls.push({
          id: String(raw.id ?? `hermes_tool_${idx}`),
          name,
          arguments: args,
        });
        idx++;
      }
    } catch {
      // Malformed JSON inside <tool_call> — skip this block.
    }
  }

  const remainingText = text.replace(HERMES_TOOL_CALL_RE, '').trim();
  return { parsedCalls, remainingText };
}

async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string | LLMToolCall> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const toolCalls = new Map<number, LLMToolCall>();

  // SSE frame buffer
  let sseBuffer = '';
  // Accumulate all text chunks so we can detect Hermes-style tool calls at the
  // end of the stream.  Text is NOT yielded immediately — it is buffered and
  // emitted after the stream completes so that raw `<tool_call>` tags are never
  // sent to the frontend.
  let textBuffer = '';

  const flushAndReturn = async function* (): AsyncGenerator<
    string | LLMToolCall
  > {
    const hasStandardToolCalls = toolCalls.size > 0;

    if (!hasStandardToolCalls && textBuffer.includes('<tool_call>')) {
      // ---------- Hermes-style fallback ----------
      const { parsedCalls, remainingText } = parseHermesToolCalls(textBuffer);
      if (remainingText) {
        yield remainingText;
      }
      for (const call of parsedCalls) {
        yield call;
      }
    } else {
      // ---------- Standard path ----------
      if (textBuffer) {
        yield textBuffer;
      }
      for (const toolCall of toolCalls.values()) {
        yield toolCall;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    sseBuffer += decoder.decode(value, { stream: true });
    const parts = sseBuffer.split('\n\n');
    sseBuffer = parts.pop() ?? '';

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
          yield* flushAndReturn();
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
          textBuffer += text;
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

  // Stream ended without an explicit `[DONE]` signal — flush everything.
  yield* flushAndReturn();
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
    const content = message?.content ?? '';
    const standardToolCalls = normalizeToolCalls(message?.tool_calls);

    // Hermes-style fallback for non-streaming responses
    if (
      (!standardToolCalls || standardToolCalls.length === 0) &&
      content.includes('<tool_call>')
    ) {
      const { parsedCalls, remainingText } = parseHermesToolCalls(content);
      if (parsedCalls.length > 0) {
        return {
          role: 'assistant',
          content: remainingText,
          toolCalls: parsedCalls,
        };
      }
    }

    return {
      role: 'assistant',
      content,
      toolCalls: standardToolCalls,
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
