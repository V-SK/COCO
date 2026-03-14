import {
  type ChatEvent,
  type CocoContext,
  type CocoPlugin,
  createRuntime,
} from '@coco/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createJsonResponse,
  createNoopLedger,
  createSseResponse,
  mockFetchOnce,
} from '../../../tests/fixtures/helpers.js';

const baseConfig = {
  llm: {
    provider: 'openai' as const,
    baseUrl: 'https://mock-llm.local',
    model: 'test-model',
  },
  chain: {
    id: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
  },
};

function buildContext(runtime: ReturnType<typeof createRuntime>): CocoContext {
  return {
    sessionId: 'session-1',
    chainId: 56,
    runtime,
    metadata: {},
  };
}

async function collectEvents(
  runtime: ReturnType<typeof createRuntime>,
  message: string,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of runtime.chat(buildContext(runtime), message)) {
    events.push(event);
  }
  return events;
}

describe('createRuntime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('streams text, executes tools, and persists the conversation', async () => {
    const fetchMock = mockFetchOnce([
      (_input, init) => {
        const payload = JSON.parse(String(init?.body));
        expect(payload.stream).toBe(true);

        return createSseResponse([
          'data: {"choices":[{"delta":{"content":"先查一下。"}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"demo.echo","arguments":"{\\"value\\":\\"hi\\"}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]);
      },
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"工具执行完成。"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
    ]);

    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock as typeof fetch,
      limitLedger: createNoopLedger(),
    });

    const plugin: CocoPlugin = {
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      tools: [
        {
          id: 'demo.echo',
          triggers: ['echo'],
          description: 'Echo input',
          schema: z.object({ value: z.string() }),
          async execute(_ctx, params: { value: string }) {
            return {
              success: true,
              data: { echoed: params.value },
              text: `echo:${params.value}`,
            };
          },
        },
      ],
      async setup() {},
    };

    await runtime.registerPlugin(plugin);
    const events = await collectEvents(runtime, 'say hi');

    expect(events).toEqual([
      { type: 'text', content: '先查一下。' },
      { type: 'tool_call', toolId: 'demo.echo', params: { value: 'hi' } },
      {
        type: 'tool_result',
        toolId: 'demo.echo',
        result: {
          success: true,
          data: { echoed: 'hi' },
          text: 'echo:hi',
        },
      },
      { type: 'text', content: '工具执行完成。' },
      { type: 'done' },
    ]);

    const session = await runtime.memory.getSession('session-1');
    expect(session.messages).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('emits an error event when tool arguments are invalid JSON', async () => {
    const fetchMock = mockFetchOnce([
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"demo.echo","arguments":"{bad json"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"已记录参数错误。"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () => createJsonResponse({}),
    ]);

    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock as typeof fetch,
      limitLedger: createNoopLedger(),
    });

    await runtime.registerPlugin({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      tools: [],
      async setup() {},
    });

    const events = await collectEvents(runtime, 'broken tool');
    expect(events).toContainEqual({
      type: 'error',
      error: 'Tool arguments were not valid JSON.',
      code: 'tool_arguments_invalid_json',
    });
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('returns structured errors for missing tools and loop overruns', async () => {
    const fetchMock = mockFetchOnce([
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"demo.loop","arguments":"{}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_2","function":{"name":"demo.loop","arguments":"{}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_3","function":{"name":"demo.loop","arguments":"{}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_4","function":{"name":"demo.loop","arguments":"{}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_5","function":{"name":"demo.loop","arguments":"{}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
    ]);

    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock as typeof fetch,
      limitLedger: createNoopLedger(),
    });
    await runtime.registerPlugin({
      id: 'demo',
      name: 'Demo',
      version: '1.0.0',
      tools: [
        {
          id: 'demo.loop',
          triggers: ['loop'],
          description: 'Loop forever',
          async execute() {
            return { success: true, data: { ok: true } };
          },
        },
      ],
      async setup() {},
    });

    expect(
      await runtime.invokeTool('missing.tool', buildContext(runtime), {}),
    ).toMatchObject({
      success: false,
      code: 'tool_not_found',
    });

    const events = await collectEvents(runtime, 'loop');
    expect(events).toContainEqual({
      type: 'error',
      error: 'Tool loop limit exceeded.',
      code: 'tool_loop_limit_exceeded',
    });

    await runtime.unregisterPlugin('demo');
    expect(runtime.plugins.size).toBe(0);
  });
});
