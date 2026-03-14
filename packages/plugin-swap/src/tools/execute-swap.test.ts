import { type CocoContext, createRuntime } from '@coco/core';
import { describe, expect, it } from 'vitest';
import { createNoopLedger } from '../../../../tests/fixtures/helpers.js';
import { setPancakeSwapService } from '../index.js';
import { executeSwapTool } from './execute-swap.js';

const fakeSwapService = {
  async init() {},
  async getQuote() {
    return {
      tokenIn: {
        symbol: 'BNB',
        address: '0x1',
        decimals: 18,
        isNative: true,
        priceSymbol: 'BNB',
      },
      tokenOut: {
        symbol: 'USDT',
        address: '0x2',
        decimals: 18,
        isNative: false,
        priceSymbol: 'USDT',
      },
      amountIn: '1',
      amountOut: '600',
      amountOutMin: '590',
      path: ['0x1', '0x2'],
      unsignedTx: {
        to: '0xrouter',
        value: '1000000000000000000',
        data: '0x1234',
      },
      amountUsd: 50,
    };
  },
};

function buildRuntime(walletMode: 'unsigned' | 'session-key') {
  return createRuntime(
    {
      llm: {
        provider: 'openai',
        baseUrl: 'https://mock-llm.local',
        model: 'unused',
      },
      chain: {
        id: 56,
        rpcUrl: 'https://bsc-dataseed.binance.org',
      },
      wallet:
        walletMode === 'session-key'
          ? {
              mode: 'session-key',
              sessionKey: {
                signer: '0x0000000000000000000000000000000000001111',
                validUntil: Math.floor(Date.now() / 1000) + 3600,
                permissions: ['swap'],
              },
              limits: {
                perTxUsd: 500,
                dailyUsd: 2000,
                requireConfirmAbove: 100,
              },
            }
          : {
              mode: 'unsigned',
            },
    },
    {
      fetch: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      limitLedger: createNoopLedger(),
    },
  );
}

describe('executeSwapTool', () => {
  it('returns unsigned transactions in unsigned mode', async () => {
    setPancakeSwapService(fakeSwapService as never);
    const runtime = buildRuntime('unsigned');
    const ctx: CocoContext = {
      sessionId: 's1',
      chainId: 56,
      walletAddress: '0x0000000000000000000000000000000000002222',
      runtime,
      metadata: {},
    };

    const result = await executeSwapTool.execute(ctx, {
      tokenIn: 'BNB',
      tokenOut: 'USDT',
      amountIn: '1',
      slippageBps: 300,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'unsigned_tx',
      quote: {
        amountOut: '600',
      },
    });
  });

  it('returns not implemented for session-key mode after validation', async () => {
    setPancakeSwapService(fakeSwapService as never);
    const runtime = buildRuntime('session-key');
    const ctx: CocoContext = {
      sessionId: 's2',
      chainId: 56,
      runtime,
      metadata: {
        walletConfirmed: true,
      },
    };

    const result = await executeSwapTool.execute(ctx, {
      tokenIn: 'BNB',
      tokenOut: 'USDT',
      amountIn: '1',
      slippageBps: 300,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('not_implemented');
  });
});
