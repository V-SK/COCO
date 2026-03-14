import { type CocoContext, createRuntime } from '@coco/core';
import { describe, expect, it } from 'vitest';
import { createNoopLedger } from '../../../../tests/fixtures/helpers.js';
import { setWalletService } from '../index.js';
import { getBalanceTool } from './get-balance.js';
import { transferTool } from './transfer.js';

const fakeWalletService = {
  async getBalance() {
    return {
      token: {
        symbol: 'BNB',
        decimals: 18,
        isNative: true,
        address: 'native',
      },
      balance: '2.5',
    };
  },
  async buildTransferTx() {
    return {
      token: {
        symbol: 'USDT',
        decimals: 18,
        isNative: false,
        address: '0x2',
      },
      tx: {
        to: '0x2',
        data: '0x1234',
        value: '0',
      },
      amountUsd: 20,
    };
  },
};

function buildRuntime() {
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
      wallet: {
        mode: 'unsigned',
      },
    },
    {
      fetch: (async () => new Response('{}', { status: 200 })) as typeof fetch,
      limitLedger: createNoopLedger(),
    },
  );
}

describe('wallet tools', () => {
  it('returns a balance summary', async () => {
    setWalletService(fakeWalletService as never);
    const result = await getBalanceTool.execute(
      {
        chainId: 56,
        sessionId: 'wallet-balance',
        walletAddress: '0x0000000000000000000000000000000000001111',
      } as CocoContext,
      { token: 'BNB' },
    );

    expect(result.success).toBe(true);
    expect(result.text).toContain('2.5');
  });

  it('returns unsigned transfer data in unsigned mode', async () => {
    setWalletService(fakeWalletService as never);
    const runtime = buildRuntime();
    const ctx: CocoContext = {
      chainId: 56,
      sessionId: 'wallet-transfer',
      runtime,
      metadata: {},
    };

    const result = await transferTool.execute(ctx, {
      token: 'USDT',
      to: '0x0000000000000000000000000000000000009999',
      amount: '20',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'unsigned_tx',
      token: {
        symbol: 'USDT',
      },
    });
  });
});
