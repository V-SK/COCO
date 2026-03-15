import { createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse } from '../../../tests/fixtures/helpers.js';
import { createPolymarketPlugin } from './index.js';

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

describe('plugin-polymarket', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists markets and keeps order placement read-only', async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse([
        {
          id: '1',
          question: 'Will BNB reach $1,000?',
          category: 'crypto',
          endDate: '2026-12-31T00:00:00.000Z',
          active: true,
          volumeNum: 1000,
          liquidityNum: 5000,
          outcomePrices: ['0.62', '0.38'],
        },
      ]),
    ) as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock,
    });
    await runtime.registerPlugin(createPolymarketPlugin());

    const list = await runtime.invokeTool(
      'polymarket.list-markets',
      {
        sessionId: 'poly-1',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        category: 'crypto',
      },
    );
    expect(list.success).toBe(true);
    expect(list.data).toHaveLength(1);

    const order = await runtime.invokeTool(
      'polymarket.place-order',
      {
        sessionId: 'poly-2',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        marketId: '1',
        side: 'YES',
        type: 'MARKET',
        size: 50,
      },
    );
    expect(order.success).toBe(false);
    expect(order.code).toBe('read_only_mode');
  });
});
