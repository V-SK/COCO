import { type CocoContext, createRuntime } from '@coco/core';
import { describe, expect, it } from 'vitest';
import { createNoopLedger } from '../../../../tests/fixtures/helpers.js';
import { setPancakeSwapService } from '../index.js';
import { getQuoteTool } from './get-quote.js';

describe('getQuoteTool', () => {
  it('returns a quote for the current execution address', async () => {
    setPancakeSwapService({
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
    } as never);

    const runtime = createRuntime(
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
      },
      {
        fetch: (async () =>
          new Response('{}', { status: 200 })) as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );

    const result = await getQuoteTool.execute(
      {
        chainId: 56,
        sessionId: 'swap-quote',
        walletAddress: '0x0000000000000000000000000000000000002222',
        runtime,
        metadata: {},
      } as CocoContext,
      {
        tokenIn: 'BNB',
        tokenOut: 'USDT',
        amountIn: '1',
        slippageBps: 300,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      amountOut: '600',
    });
  });
});
