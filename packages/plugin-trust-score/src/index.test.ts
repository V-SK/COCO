import { type CocoPlugin, createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse } from '../../../tests/fixtures/helpers.js';
import { createTrustScorePlugin } from './index.js';

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

describe('plugin-trust-score', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes missing modules to N/A and returns a coverage score', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('mock-llm.local')) {
        return createJsonResponse({
          choices: [{ message: { content: 'Risk remains moderate.' } }],
        });
      }
      if (url.includes('gopluslabs')) {
        return createJsonResponse({
          result: {
            '0xtoken': {
              is_honeypot: '0',
              is_blacklisted: '0',
              can_take_back_ownership: '0',
            },
          },
        });
      }
      if (url.includes('dexscreener')) {
        return createJsonResponse({
          pairs: [
            {
              liquidity: { usd: 1000000 },
              volume: { h24: 250000 },
              priceChange: { h24: 3.2 },
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
    const newsPlugin: CocoPlugin = {
      id: 'news-test',
      name: 'News Test',
      version: '1.0.0',
      tools: [
        {
          id: 'news.get-sentiment',
          triggers: ['news'],
          description: 'Stubbed news sentiment',
          async execute() {
            return {
              success: true,
              data: {
                overall: 40,
                newsCount: 3,
                aiSummary: 'Sentiment is constructive.',
              },
            };
          },
        },
      ],
      async setup() {},
    };
    await runtime.registerPlugin(newsPlugin);
    await runtime.registerPlugin(createTrustScorePlugin());

    const result = await runtime.invokeTool(
      'trust-score.get-trust-score',
      {
        sessionId: 'trust-1',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        token: '0xtoken',
        detailed: true,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      token: '0XTOKEN',
    });
    const data = result.data as {
      coverage: number;
      breakdown: { team: { score: string }; history: { score: string } };
    };
    expect(data.coverage).toBeGreaterThan(0);
    expect(data.breakdown.team.score).toBe('N/A');
    expect(data.breakdown.history.score).toBe('N/A');
  });
});
