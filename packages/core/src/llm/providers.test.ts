import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createJsonResponse,
  createSseResponse,
} from '../../../../tests/fixtures/helpers.js';
import { AnthropicProvider } from './anthropic.js';
import { createLLMProvider } from './index.js';
import { OpenAICompatibleProvider } from './openai-compat.js';

describe('LLM providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes OpenAI-compatible chat responses', async () => {
    const provider = new OpenAICompatibleProvider(
      {
        baseUrl: 'https://mock-llm.local',
        model: 'test-model',
      },
      {
        fetchImpl: (async () =>
          createJsonResponse({
            choices: [
              {
                message: {
                  content: 'hello',
                  tool_calls: [
                    {
                      id: 'call_1',
                      function: {
                        name: 'demo.echo',
                        arguments: '{"value":"hi"}',
                      },
                    },
                  ],
                },
              },
            ],
          })) as typeof fetch,
      },
    );

    const message = await provider.chat(
      [{ role: 'user', content: 'hello' }],
      [],
    );
    expect(message.content).toBe('hello');
    expect(message.toolCalls?.[0]?.name).toBe('demo.echo');
  });

  it('parses OpenAI-compatible streaming tool calls', async () => {
    const provider = new OpenAICompatibleProvider(
      {
        baseUrl: 'https://mock-llm.local',
        model: 'test-model',
      },
      {
        fetchImpl: (async () =>
          createSseResponse([
            'data: {"choices":[{"delta":{"content":"hi "}}]}\n\n',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"demo.echo","arguments":"{\\"value\\":\\"hi\\"}"}}]}}]}\n\n',
            'data: [DONE]\n\n',
          ])) as typeof fetch,
      },
    );

    const chunks: Array<
      string | { id: string; name: string; arguments: string }
    > = [];
    for await (const chunk of provider.chatStream(
      [{ role: 'user', content: 'hello' }],
      [],
    )) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      'hi ',
      {
        id: 'call_1',
        name: 'demo.echo',
        arguments: '{"value":"hi"}',
      },
    ]);
  });

  it('normalizes Anthropic tool_use responses', async () => {
    const provider = new AnthropicProvider(
      {
        baseUrl: 'https://mock-anthropic.local',
        model: 'claude-test',
      },
      {
        fetchImpl: (async () =>
          createJsonResponse({
            content: [
              { type: 'text', text: 'done' },
              {
                type: 'tool_use',
                id: 'tool_1',
                name: 'demo.echo',
                input: { value: 'hi' },
              },
            ],
          })) as typeof fetch,
      },
    );

    const message = await provider.chat(
      [{ role: 'user', content: 'hello' }],
      [],
    );
    expect(message.content).toBe('done');
    expect(message.toolCalls?.[0]).toEqual({
      id: 'tool_1',
      name: 'demo.echo',
      arguments: '{"value":"hi"}',
    });
  });

  it('creates a vllm provider through the factory', async () => {
    const provider = createLLMProvider(
      {
        provider: 'vllm',
        baseUrl: 'https://mock-vllm.local',
        model: 'qwen',
      },
      {
        fetch: (async () =>
          createJsonResponse({
            choices: [{ message: { content: 'factory-ok' } }],
          })) as typeof fetch,
      },
    );

    const message = await provider.chat(
      [{ role: 'user', content: 'test' }],
      [],
    );
    expect(message.content).toBe('factory-ok');
  });
});
