import { type CocoPlugin, createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutoTradePlugin } from './index.js';

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

describe('plugin-auto-trade', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supports default risk templates and full custom disable mode', async () => {
    const runtime = createRuntime(baseConfig, {
      fetch: vi.fn(async () => new Response('{}')) as typeof fetch,
    });
    const quantPlugin: CocoPlugin = {
      id: 'quant-test',
      name: 'Quant Test',
      version: '1.0.0',
      tools: [
        {
          id: 'quant-signal.get-signal',
          triggers: ['signal'],
          description: 'Stub signal',
          async execute() {
            return {
              success: true,
              data: { type: 'BUY', confidence: 80 },
            };
          },
        },
        {
          id: 'dex-agg.execute-swap',
          triggers: ['swap'],
          description: 'Stub swap',
          async execute() {
            return {
              success: true,
              data: { type: 'signed_tx', txHash: '0xauto' },
            };
          },
        },
      ],
      async setup() {},
    };
    await runtime.registerPlugin(quantPlugin);
    await runtime.registerPlugin(createAutoTradePlugin());

    const ctx = {
      sessionId: 'auto-1',
      chainId: 56,
      runtime,
      metadata: {},
    };

    const paper = await runtime.invokeTool('auto-trade.start-strategy', ctx, {
      strategy: 'signal-follow',
      token: 'BNB',
      config: {
        mode: 'paper',
        confirmBeforeExecute: false,
        userRisk: {
          useDefaultTemplate: true,
          customConfig: {
            maxSingleTradeUsd: 5000,
          },
        },
      },
    });
    expect(paper.success).toBe(true);
    expect(paper.data).toMatchObject({
      run: {
        riskConfig: {
          resolved: {
            maxSingleTradeUsd: 5000,
          },
        },
      },
    });

    const live = await runtime.invokeTool('auto-trade.start-strategy', ctx, {
      strategy: 'grid',
      token: 'BNB',
      config: {
        mode: 'live',
        confirmBeforeExecute: true,
        userRisk: {
          useDefaultTemplate: false,
        },
      },
    });
    expect(live.success).toBe(true);
    expect(live.data).toMatchObject({
      confirmation: {
        type: 'confirmation_required',
      },
    });
  });
});
