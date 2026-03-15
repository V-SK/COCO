import {
  CocoError,
  type CocoPlugin,
  type CocoTool,
  assertReadOnlySql,
  optionalImport,
} from '@coco/core';
import Database from 'better-sqlite3';
import { z } from 'zod';

export interface SQLConfig {
  type: 'sqlite' | 'mysql' | 'postgres';
  connectionString?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  database?: string | undefined;
  user?: string | undefined;
  password?: string | undefined;
  readonly?: boolean | undefined;
}

class SQLService {
  readonly #config: SQLConfig;
  readonly #sqlite?: Database.Database;

  constructor(config: SQLConfig) {
    this.#config = config;
    if (config.type === 'sqlite') {
      this.#sqlite = new Database(
        config.connectionString ?? config.database ?? ':memory:',
      );
    }
  }

  async query(sql: string, params: unknown[]) {
    if (this.#config.readonly ?? true) {
      assertReadOnlySql(sql);
    }

    if (this.#config.type === 'sqlite') {
      const statement = this.#sqlite?.prepare(sql);
      if (!statement) {
        throw new CocoError(
          'SQLite statement could not be prepared.',
          'sql_prepare_failed',
        );
      }
      if (/^\s*select|^\s*pragma|^\s*with/i.test(sql)) {
        return statement.all(...params);
      }
      return statement.run(...params);
    }

    if (this.#config.type === 'mysql') {
      const mysql = await optionalImport<{
        createConnection: (options: Record<string, unknown>) => Promise<{
          execute: (sqlText: string, values: unknown[]) => Promise<[unknown]>;
          end: () => Promise<void>;
        }>;
      }>('mysql2/promise');
      if (!mysql) {
        throw new CocoError(
          'mysql2 is not installed.',
          'sql_dependency_missing',
        );
      }
      const connection = await mysql.createConnection({
        host: this.#config.host,
        port: this.#config.port,
        database: this.#config.database,
        user: this.#config.user,
        password: this.#config.password,
        uri: this.#config.connectionString,
      });
      try {
        const [rows] = await connection.execute(sql, params);
        return rows;
      } finally {
        await connection.end();
      }
    }

    const pg = await optionalImport<{
      Client: new (
        options: Record<string, unknown>,
      ) => {
        connect: () => Promise<void>;
        query: (
          sqlText: string,
          values: unknown[],
        ) => Promise<{ rows: unknown[] }>;
        end: () => Promise<void>;
      };
    }>('pg');
    if (!pg) {
      throw new CocoError('pg is not installed.', 'sql_dependency_missing');
    }
    const client = new pg.Client({
      host: this.#config.host,
      port: this.#config.port,
      database: this.#config.database,
      user: this.#config.user,
      password: this.#config.password,
      connectionString: this.#config.connectionString,
    });
    await client.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      await client.end();
    }
  }
}

let sqlService = new SQLService({ type: 'sqlite', readonly: true });

export function createSQLPlugin(
  config: SQLConfig = { type: 'sqlite', readonly: true },
): CocoPlugin {
  const querySchema = z.object({
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
  });
  const describeSchema = z.object({
    table: z.string(),
  });
  const listSchema = z.object({
    schema: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'sql.query',
      triggers: ['sql', 'query', 'database'],
      description: 'Run a SQL query.',
      schema: querySchema,
      requiresConfirmation: !(config.readonly ?? true),
      async execute(_ctx, params: z.infer<typeof querySchema>) {
        return {
          success: true,
          data: await sqlService.query(params.sql, params.params ?? []),
        };
      },
    },
    {
      id: 'sql.describe',
      triggers: ['sql', 'describe', 'table'],
      description: 'Describe a SQL table.',
      schema: describeSchema,
      async execute(_ctx, params: z.infer<typeof describeSchema>) {
        const sql =
          config.type === 'postgres'
            ? 'select column_name, data_type from information_schema.columns where table_name = $1'
            : config.type === 'mysql'
              ? `describe ${params.table}`
              : `pragma table_info(${params.table})`;
        const values = config.type === 'postgres' ? [params.table] : [];
        return { success: true, data: await sqlService.query(sql, values) };
      },
    },
    {
      id: 'sql.list-tables',
      triggers: ['sql', 'list', 'tables'],
      description: 'List database tables.',
      schema: listSchema,
      async execute() {
        const sql =
          config.type === 'postgres'
            ? 'select table_name from information_schema.tables where table_schema = current_schema()'
            : config.type === 'mysql'
              ? 'show tables'
              : `select name from sqlite_master where type = 'table' order by name`;
        return { success: true, data: await sqlService.query(sql, []) };
      },
    },
  ];

  return {
    id: 'sql',
    name: 'Coco SQL',
    version: '1.2.0',
    description: 'Readonly-first SQL access',
    async setup() {
      sqlService = new SQLService(config);
    },
    tools,
  };
}

export const sqlPlugin = createSQLPlugin();

export default sqlPlugin;
