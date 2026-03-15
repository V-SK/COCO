import { createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse } from '../../../tests/fixtures/helpers.js';
import {
  calculateBollinger,
  calculateMacd,
  calculateRsi,
  createQuantSignalPlugin,
} from './index.js';

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

describe('plugin-quant-signal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes core indicators', () => {
    const data = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(calculateRsi(data)).toBeGreaterThan(50);
    expect(calculateMacd(data).macd).toBeGreaterThan(0);
    expect(calculateBollinger(data).upper).toBeGreaterThan(
      calculateBollinger(data).lower,
    );
  });

  it('generates a signal with mocked external market data', async () => {
    const klines = Array.from({ length: 60 }, (_, index) => [
      Date.UTC(2026, 2, 10, index),
      `${100 + index}`,
      `${101 + index}`,
      `${99 + index}`,
      `${100 + index}`,
      '1000',
    ]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('mock-llm.local')) {
        return createJsonResponse({
          choices: [{ message: { content: 'Momentum remains favorable.' } }],
        });
      }
      if (url.includes('api.binance.com')) {
        return createJsonResponse(klines);
      }
      if (url.includes('dexscreener')) {
        return createJsonResponse({
          pairs: [
            {
              priceUsd: '160',
              liquidity: { usd: 1200000 },
              volume: { h24: 400000 },
              txns: { h24: { buys: 70, sells: 30 } },
            },
          ],
        });
      }
      return createJsonResponse({
        result: [
          { from: '0xa', to: '0xb', value: '100' },
          { from: '0xb', to: '0xc', value: '100' },
        ],
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock as typeof fetch,
    });
    await runtime.registerPlugin(createQuantSignalPlugin());

    const result = await runtime.invokeTool(
      'quant-signal.get-signal',
      {
        sessionId: 'signal-1',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        token: 'BNB',
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      token: 'BNB',
    });
  });
});
