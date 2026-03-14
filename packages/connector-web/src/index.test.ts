import type { CocoPlugin } from '@coco/core';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  createNoopLedger,
  createSseResponse,
  mockFetchOnce,
} from '../../../tests/fixtures/helpers.js';
import { createWebConnector } from './index.js';

const plugin: CocoPlugin = {
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  async setup() {},
  tools: [
    {
      id: 'demo.ping',
      triggers: ['ping'],
      description: 'Ping tool',
      async execute(_ctx, params) {
        return {
          success: true,
          data: params,
        };
      },
    },
  ],
};

describe('createWebConnector', () => {
  const connectors: Array<Awaited<ReturnType<typeof createWebConnector>>> = [];

  afterEach(async () => {
    while (connectors.length > 0) {
      const connector = connectors.pop();
      if (connector) {
        await connector.stop();
      }
    }
  });

  it('serves health, tools, sessions, and websocket chat', async () => {
    const fetchMock = mockFetchOnce([
      () =>
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"pong"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
    ]);

    const connector = await createWebConnector(
      {
        llm: {
          provider: 'openai',
          baseUrl: 'https://mock-llm.local',
          model: 'test-model',
        },
        chain: {
          id: 56,
          rpcUrl: 'https://bsc-dataseed.binance.org',
        },
        host: '127.0.0.1',
        port: 0,
      },
      [plugin],
      {
        fetch: fetchMock as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );
    connectors.push(connector);
    await connector.start();

    const address = connector.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = (await fetch(`${baseUrl}/health`).then((res) =>
      res.json(),
    )) as { walletMode: string; plugins: string[] };
    const tools = (await fetch(`${baseUrl}/tools`).then((res) =>
      res.json(),
    )) as { tools: Array<{ function: { name: string } }> };
    const session = (await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then((res) => res.json())) as { sessionId: string };

    expect(health.walletMode).toBe('unsigned');
    expect(health.plugins).toEqual(['demo']);
    expect(tools.tools[0]?.function.name).toBe('demo.ping');
    expect(session.sessionId).toBeTruthy();

    const wsEvents = await new Promise<
      Array<{ type: string; content?: string }>
    >((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
      const events: Array<{ type: string; content?: string }> = [];

      socket.on('open', () => {
        socket.send(
          JSON.stringify({
            type: 'chat',
            sessionId: session.sessionId,
            message: 'ping',
          }),
        );
      });
      socket.on('message', (raw) => {
        const event = JSON.parse(raw.toString()) as {
          type: string;
          content?: string;
        };
        events.push(event);
        if (event.type === 'done') {
          socket.close();
          resolve(events);
        }
      });
      socket.on('error', reject);
    });

    expect(wsEvents).toEqual([
      { type: 'text', content: 'pong' },
      { type: 'done' },
    ]);
  });

  it('returns websocket errors for invalid payloads', async () => {
    const connector = await createWebConnector(
      {
        llm: {
          provider: 'openai',
          baseUrl: 'https://mock-llm.local',
          model: 'test-model',
        },
        chain: {
          id: 56,
          rpcUrl: 'https://bsc-dataseed.binance.org',
        },
        host: '127.0.0.1',
        port: 0,
      },
      [plugin],
      {
        fetch: (async () => createSseResponse([])) as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );
    connectors.push(connector);
    await connector.start();

    const address = connector.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address');
    }

    const event = await new Promise<{ type: string; code?: string }>(
      (resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
        socket.on('open', () => {
          socket.send(JSON.stringify({ type: 'bad' }));
        });
        socket.on('message', (raw) => {
          const payload = JSON.parse(raw.toString()) as {
            type: string;
            code?: string;
          };
          socket.close();
          resolve(payload);
        });
        socket.on('error', reject);
      },
    );

    expect(event).toEqual({
      type: 'error',
      code: 'invalid_ws_payload',
      error: 'Invalid websocket payload.',
    });
  });
});
