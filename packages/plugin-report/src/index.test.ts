import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CocoPlugin, createRuntime } from '@coco/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReportPlugin } from './index.js';

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

const tempPaths: string[] = [];

describe('plugin-report', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempPaths.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      }),
    );
  });

  it('generates a markdown token report using existing tool outputs', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'coco-report-'));
    tempPaths.push(outputDir);
    const runtime = createRuntime(baseConfig, {
      fetch: vi.fn(async () => new Response('{}')) as typeof fetch,
    });
    const stubs: CocoPlugin = {
      id: 'report-stubs',
      name: 'Report Stubs',
      version: '1.0.0',
      tools: [
        {
          id: 'trust-score.get-trust-score',
          triggers: ['trust'],
          description: 'Trust stub',
          async execute() {
            return { success: true, data: { overall: 85, grade: 'A' } };
          },
        },
        {
          id: 'quant-signal.get-signal',
          triggers: ['signal'],
          description: 'Signal stub',
          async execute() {
            return { success: true, data: { type: 'BUY', confidence: 88 } };
          },
        },
        {
          id: 'news.get-news',
          triggers: ['news'],
          description: 'News stub',
          async execute() {
            return { success: true, data: [{ title: 'BNB rises' }] };
          },
        },
        {
          id: 'history.get-tx-history',
          triggers: ['history'],
          description: 'History stub',
          async execute() {
            return { success: true, data: [] };
          },
        },
        {
          id: 'auto-trade.get-positions',
          triggers: ['positions'],
          description: 'Position stub',
          async execute() {
            return { success: true, data: [] };
          },
        },
      ],
      async setup() {},
    };
    await runtime.registerPlugin(stubs);
    await runtime.registerPlugin(createReportPlugin({ outputDir }));

    const result = await runtime.invokeTool(
      'report.generate-report',
      {
        sessionId: 'report-1',
        chainId: 56,
        runtime,
        metadata: {},
      },
      {
        type: 'token-analysis',
        format: 'md',
        token: 'BNB',
      },
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      format: 'md',
    });
  });
});
