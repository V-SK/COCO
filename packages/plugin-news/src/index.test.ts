import { createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse } from '../../../tests/fixtures/helpers.js';
import { createNewsPlugin } from './index.js';

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

describe('plugin-news', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates news and produces a token sentiment summary', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('mock-llm.local')) {
        return createJsonResponse({
          choices: [
            { message: { content: 'BNB sentiment remains constructive.' } },
          ],
        });
      }
      if (url.includes('cryptopanic.com')) {
        return createJsonResponse({
          results: [
            {
              title: 'BNB partnership boosts ecosystem',
              url: 'https://cryptopanic.local/bnb',
              published_at: '2026-03-14T12:00:00.000Z',
              source: { title: 'CryptoPanic' },
              currencies: [{ code: 'BNB' }],
            },
          ],
        });
      }
      return new Response(
        `
          <rss><channel>
            <item>
              <title>BNB rallies on bullish inflows</title>
              <link>https://feed.local/bnb</link>
              <description>Binance coin sees a surge and buy momentum.</description>
              <pubDate>Sat, 14 Mar 2026 12:00:00 GMT</pubDate>
            </item>
          </channel></rss>
        `,
        { status: 200, headers: { 'content-type': 'application/xml' } },
      );
    });

    vi.stubGlobal('fetch', fetchMock);
    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock as typeof fetch,
    });
    await runtime.registerPlugin(
      createNewsPlugin({
        rssFeeds: ['https://feed.local/rss'],
      }),
    );

    const result = await runtime.invokeTool(
      'news.get-sentiment',
      {
        sessionId: 'news-1',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        token: 'BNB',
        period: '24h',
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      token: 'BNB',
    });
    expect(
      (result.data as { newsCount: number }).newsCount,
    ).toBeGreaterThanOrEqual(2);
    expect((result.data as { aiSummary: string }).aiSummary).toContain('BNB');
  });
});
