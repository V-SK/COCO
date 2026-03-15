import { type CocoContext, createRuntime } from '@coco/core';
import { Wallet } from 'ethers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNoopLedger } from '../../../../tests/fixtures/helpers.js';

const PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945382dbd8c6dd8a9c04cb2a4bbf2c65f75f73';

describe('DefaultWalletExecutor via runtime', () => {
  afterEach(() => {
    process.env.COCO_TEST_PRIVATE_KEY = undefined;
    vi.restoreAllMocks();
  });

  it('returns confirmation-required for delegated transactions above threshold', async () => {
    process.env.COCO_TEST_PRIVATE_KEY = PRIVATE_KEY;
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
        wallet: {
          mode: 'delegated',
          privateKey: 'COCO_TEST_PRIVATE_KEY',
          limits: {
            perTxUsd: 500,
            dailyUsd: 2000,
            requireConfirmAbove: 100,
          },
        },
      },
      {
        fetch: (async () =>
          new Response('{}', { status: 200 })) as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );

    const ctx: CocoContext = {
      sessionId: 'confirm-1',
      chainId: 56,
      runtime,
      metadata: {},
    };
    const result = await runtime.executeTransaction({
      operation: 'transfer',
      toolId: 'wallet.transfer',
      ctx,
      tx: {
        to: '0x0000000000000000000000000000000000009999',
        value: '1',
      },
      amountUsd: 150,
      description: 'Delegated transfer',
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      type: 'confirmation_required',
      amountUsd: 150,
    });
  });

  it('broadcasts delegated transactions once confirmed', async () => {
    process.env.COCO_TEST_PRIVATE_KEY = PRIVATE_KEY;
    const record = vi.fn();
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
        wallet: {
          mode: 'delegated',
          privateKey: 'COCO_TEST_PRIVATE_KEY',
          limits: {
            perTxUsd: 500,
            dailyUsd: 2000,
            requireConfirmAbove: 100,
          },
        },
      },
      {
        fetch: (async () =>
          new Response('{}', { status: 200 })) as typeof fetch,
        limitLedger: {
          ...createNoopLedger(),
          record,
        },
      },
    );

    vi.spyOn(Wallet.prototype, 'sendTransaction').mockResolvedValue({
      hash: '0xabc',
    } as never);

    const ctx: CocoContext = {
      sessionId: 'send-1',
      chainId: 56,
      runtime,
      metadata: {
        walletConfirmed: true,
      },
    };
    const result = await runtime.executeTransaction({
      operation: 'transfer',
      toolId: 'wallet.transfer',
      ctx,
      tx: {
        to: '0x0000000000000000000000000000000000009999',
        value: '1',
      },
      amountUsd: 50,
      description: 'Delegated transfer',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      type: 'signed_tx',
      txHash: '0xabc',
    });
    expect(record).toHaveBeenCalled();
  });

  it('broadcasts session-key transactions when signer config and key match', async () => {
    process.env.COCO_TEST_PRIVATE_KEY = PRIVATE_KEY;
    vi.spyOn(Wallet.prototype, 'sendTransaction').mockResolvedValue({
      hash: '0xsession',
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
        wallet: {
          mode: 'session-key',
          privateKey: 'COCO_TEST_PRIVATE_KEY',
          sessionKey: {
            signer: new Wallet(PRIVATE_KEY).address,
            validUntil: Math.floor(Date.now() / 1000) + 3600,
            permissions: ['transfer'],
          },
          limits: {
            perTxUsd: 500,
            dailyUsd: 2000,
            requireConfirmAbove: 100,
          },
        },
      },
      {
        fetch: (async () =>
          new Response('{}', { status: 200 })) as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );

    const ctx: CocoContext = {
      sessionId: 'session-key-1',
      chainId: 56,
      runtime,
      metadata: {
        walletConfirmed: true,
      },
    };

    const result = await runtime.executeTransaction({
      operation: 'transfer',
      toolId: 'wallet.transfer',
      ctx,
      tx: {
        to: '0x0000000000000000000000000000000000009999',
        value: '1',
      },
      amountUsd: 50,
      description: 'Session-key transfer',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      type: 'signed_tx',
      txHash: '0xsession',
    });
  });

  it('rejects session-key transactions outside configured permissions', async () => {
    process.env.COCO_TEST_PRIVATE_KEY = PRIVATE_KEY;
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
        wallet: {
          mode: 'session-key',
          privateKey: 'COCO_TEST_PRIVATE_KEY',
          sessionKey: {
            signer: new Wallet(PRIVATE_KEY).address,
            validUntil: Math.floor(Date.now() / 1000) + 3600,
            permissions: ['transfer'],
          },
          limits: {
            perTxUsd: 500,
            dailyUsd: 2000,
            requireConfirmAbove: 100,
          },
        },
      },
      {
        fetch: (async () =>
          new Response('{}', { status: 200 })) as typeof fetch,
        limitLedger: createNoopLedger(),
      },
    );

    const result = await runtime.executeTransaction({
      operation: 'swap',
      toolId: 'swap.execute',
      ctx: {
        sessionId: 'session-key-2',
        chainId: 56,
        runtime,
        metadata: {
          walletConfirmed: true,
        },
      },
      tx: {
        to: '0x0000000000000000000000000000000000009999',
        value: '1',
      },
      amountUsd: 50,
      description: 'Session-key swap',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('session_key_permission_denied');
  });
});
