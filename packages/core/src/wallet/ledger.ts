import Database from 'better-sqlite3';
import { DEFAULT_LIMITS_DB_PATH } from '../constants.js';
import { CocoError } from '../errors.js';
import type { LimitCheckInput, LimitLedger, LimitRecord } from '../types.js';

function getUtcDay(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export class SqliteLimitLedger implements LimitLedger {
  readonly #db: Database.Database;

  constructor(path = DEFAULT_LIMITS_DB_PATH) {
    this.#db = new Database(path);
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS limit_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        chain_id INTEGER NOT NULL,
        mode TEXT NOT NULL,
        utc_day TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_limit_records_subject_day
      ON limit_records(subject_id, utc_day);
    `);
  }

  async getDailyTotal(
    subjectId: string,
    timestamp = Date.now(),
  ): Promise<number> {
    const row = this.#db
      .prepare(
        `
        SELECT COALESCE(SUM(amount_usd), 0) AS total
        FROM limit_records
        WHERE subject_id = ? AND utc_day = ?
      `,
      )
      .get(subjectId, getUtcDay(timestamp)) as { total: number };

    return row.total;
  }

  async ensureWithinLimits(input: LimitCheckInput): Promise<void> {
    if (input.amountUsd > input.limits.perTxUsd) {
      throw new CocoError(
        `Transaction exceeds per-transaction limit of $${input.limits.perTxUsd}.`,
        'limit_per_tx_exceeded',
      );
    }

    const dailyTotal = await this.getDailyTotal(
      input.subjectId,
      input.timestamp,
    );
    if (dailyTotal + input.amountUsd > input.limits.dailyUsd) {
      throw new CocoError(
        `Transaction exceeds daily limit of $${input.limits.dailyUsd}.`,
        'limit_daily_exceeded',
      );
    }
  }

  async record(entry: LimitRecord): Promise<void> {
    const timestamp = entry.timestamp ?? Date.now();
    this.#db
      .prepare(
        `
        INSERT INTO limit_records (
          subject_id, tool_id, tx_hash, amount_usd, chain_id, mode, utc_day, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        entry.subjectId,
        entry.toolId,
        entry.txHash,
        entry.amountUsd,
        entry.chainId,
        entry.mode,
        getUtcDay(timestamp),
        timestamp,
      );
  }

  async close(): Promise<void> {
    this.#db.close();
  }
}
