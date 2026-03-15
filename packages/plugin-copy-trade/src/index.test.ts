import { type CocoPlugin, createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJsonResponse } from '../../../tests/fixtures/helpers.js';
import { createCopyTradePlugin } from './index.js';

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

describe('plugin-copy-trade', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('follows wallets and syncs confirmed swap trades through filters', async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        result: [
          {
            hash: '0xswap',
            timeStamp: `${Math.floor(Date.now() / 1000)}`,
            input: '0x38ed1739abcdef',
            value: '200',
            contractAddress: 'BNB',
            tokenSymbol: 'USDT',
          },
          {
            hash: '0xtransfer',
            timeStamp: `${Math.floor(Date.now() / 1000)}`,
            input: '0x',
            value: '10',
            contractAddress: 'BNB',
            tokenSymbol: 'USDT',
          },
        ],
      }),
    ) as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const runtime = createRuntime(baseConfig, {
      fetch: fetchMock,
    });
    const trustPlugin: CocoPlugin = {
      id: 'trust-test',
      name: 'Trust Test',
      version: '1.0.0',
      tools: [
        {
          id: 'trust-score.get-trust-score',
          triggers: ['trust'],
          description: 'Trust stub',
          async execute() {
            return {
              success: true,
              data: { overall: 80 },
            };
          },
        },
        {
          id: 'dex-agg.execute-swap',
          triggers: ['swap'],
          description: 'Swap stub',
          async execute() {
            return {
              success: true,
              data: { type: 'paper_fill' },
            };
          },
        },
      ],
      async setup() {},
    };
    await runtime.registerPlugin(trustPlugin);
    await runtime.registerPlugin(createCopyTradePlugin());
    const ctx = {
      sessionId: 'copy-1',
      chainId: 56,
      runtime,
      metadata: {},
    };

    await runtime.invokeTool('copy-trade.follow-wallet', ctx, {
      address: '0xwallet',
      config: {
        mode: 'paper',
        positionMode: 'FIXED',
        fixedAmountUsd: 50,
        minTradeUsd: 10,
        maxTradeUsd: 500,
        delayMs: 0,
        requireConfirmation: false,
      },
    });

    const sync = await runtime.invokeTool('copy-trade.sync-followed', ctx, {});
    expect(sync.success).toBe(true);
    expect(sync.data).toMatchObject([
      {
        copied: [{ txHash: '0xswap' }],
      },
    ]);
  });
});
