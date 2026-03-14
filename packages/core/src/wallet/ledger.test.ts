import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteLimitLedger } from '@coco/core';
import { afterEach, describe, expect, it } from 'vitest';

const tempPaths: string[] = [];

describe('SqliteLimitLedger', () => {
  afterEach(async () => {
    await Promise.all(
      tempPaths.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      }),
    );
  });

  it('tracks daily totals and resets on a new UTC day', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coco-ledger-'));
    tempPaths.push(directory);
    const ledger = new SqliteLimitLedger(join(directory, 'limits.sqlite'));

    await ledger.record({
      subjectId: 'user-1',
      toolId: 'wallet.transfer',
      txHash: '0xabc',
      amountUsd: 25,
      chainId: 56,
      mode: 'delegated',
      timestamp: Date.UTC(2026, 2, 14, 23, 0, 0),
    });

    await ledger.record({
      subjectId: 'user-1',
      toolId: 'wallet.transfer',
      txHash: '0xdef',
      amountUsd: 10,
      chainId: 56,
      mode: 'delegated',
      timestamp: Date.UTC(2026, 2, 14, 23, 30, 0),
    });

    expect(
      await ledger.getDailyTotal('user-1', Date.UTC(2026, 2, 14, 23, 59, 59)),
    ).toBe(35);
    expect(
      await ledger.getDailyTotal('user-1', Date.UTC(2026, 2, 15, 0, 0, 1)),
    ).toBe(0);

    await ledger.close();
  });

  it('rejects transactions that exceed configured limits', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coco-ledger-'));
    tempPaths.push(directory);
    const ledger = new SqliteLimitLedger(join(directory, 'limits.sqlite'));

    await ledger.record({
      subjectId: 'user-2',
      toolId: 'swap.execute',
      txHash: '0x1',
      amountUsd: 40,
      chainId: 56,
      mode: 'custodial',
      timestamp: Date.UTC(2026, 2, 14, 12, 0, 0),
    });

    await expect(
      ledger.ensureWithinLimits({
        subjectId: 'user-2',
        amountUsd: 15,
        limits: {
          perTxUsd: 100,
          dailyUsd: 50,
          requireConfirmAbove: 10,
        },
        timestamp: Date.UTC(2026, 2, 14, 13, 0, 0),
      }),
    ).rejects.toMatchObject({ code: 'limit_daily_exceeded' });

    await expect(
      ledger.ensureWithinLimits({
        subjectId: 'user-2',
        amountUsd: 101,
        limits: {
          perTxUsd: 100,
          dailyUsd: 500,
        },
      }),
    ).rejects.toMatchObject({ code: 'limit_per_tx_exceeded' });

    await ledger.close();
  });
});
