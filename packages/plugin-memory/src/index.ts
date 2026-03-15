import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type {
  CocoPlugin,
  LLMMessage,
  MemoryRecord,
  PersistentMemoryStore,
  RecallOptions,
  SessionRecord,
} from '@coco/core';
import { type CocoTool, InMemoryPersistentMemoryStore } from '@coco/core';
import Database from 'better-sqlite3';
import { z } from 'zod';

export interface MemoryConfig {
  storage: 'sqlite' | 'file';
  storagePath: string;
  maxMemories?: number | undefined;
  ttlDays?: number | undefined;
}

class SqliteMemoryStore implements PersistentMemoryStore {
  readonly #db: Database.Database;

  constructor(path: string) {
    this.#db = new Database(path);
    this.#db.exec(`
      create table if not exists sessions (
        session_id text primary key,
        payload text not null
      );
      create table if not exists memories (
        id text primary key,
        session_id text not null,
        user_id text,
        type text not null,
        content text not null,
        embedding text,
        importance real not null,
        created_at integer not null,
        accessed_at integer not null,
        access_count integer not null
      );
    `);
  }

  async getSession(sessionId: string): Promise<SessionRecord> {
    const row = this.#db
      .prepare('select payload from sessions where session_id = ?')
      .get(sessionId) as { payload?: string } | undefined;
    return row?.payload
      ? (JSON.parse(row.payload) as SessionRecord)
      : { messages: [], metadata: {} };
  }

  async appendMessages(
    sessionId: string,
    messages: LLMMessage[],
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    this.#db
      .prepare(
        'insert or replace into sessions (session_id, payload) values (?, ?)',
      )
      .run(
        sessionId,
        JSON.stringify({
          messages: [...session.messages, ...messages],
          metadata: session.metadata,
        }),
      );
  }

  async mergeMetadata(
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    this.#db
      .prepare(
        'insert or replace into sessions (session_id, payload) values (?, ?)',
      )
      .run(
        sessionId,
        JSON.stringify({
          messages: session.messages,
          metadata: { ...session.metadata, ...metadata },
        }),
      );
  }

  async clearSession(sessionId: string): Promise<void> {
    this.#db
      .prepare('delete from sessions where session_id = ?')
      .run(sessionId);
  }

  async remember(
    memory: Omit<
      MemoryRecord,
      'id' | 'createdAt' | 'accessedAt' | 'accessCount'
    >,
  ): Promise<MemoryRecord> {
    const now = new Date();
    const record: MemoryRecord = {
      ...memory,
      id: randomUUID(),
      createdAt: now,
      accessedAt: now,
      accessCount: 0,
    };
    this.#db
      .prepare(`
        insert into memories (
          id, session_id, user_id, type, content, embedding, importance,
          created_at, accessed_at, access_count
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.sessionId,
        record.userId ?? null,
        record.type,
        record.content,
        JSON.stringify(record.embedding ?? []),
        record.importance,
        record.createdAt.getTime(),
        record.accessedAt.getTime(),
        record.accessCount,
      );
    return record;
  }

  async recall(
    query: string,
    options: RecallOptions = {},
  ): Promise<MemoryRecord[]> {
    const rows = this.#db
      .prepare(
        `
          select * from memories
          where content like ?
          order by importance desc, accessed_at desc
          limit ?
        `,
      )
      .all(`%${query}%`, options.limit ?? 5) as Array<Record<string, unknown>>;
    return rows
      .filter((row) =>
        options.sessionId ? row.session_id === options.sessionId : true,
      )
      .filter((row) => (options.userId ? row.user_id === options.userId : true))
      .filter((row) => (options.type ? row.type === options.type : true))
      .filter((row) =>
        options.minImportance != null
          ? Number(row.importance) >= options.minImportance
          : true,
      )
      .map((row) => ({
        id: String(row.id),
        sessionId: String(row.session_id),
        userId: row.user_id ? String(row.user_id) : undefined,
        type: row.type as MemoryRecord['type'],
        content: String(row.content),
        embedding: JSON.parse(String(row.embedding ?? '[]')) as number[],
        importance: Number(row.importance),
        createdAt: new Date(Number(row.created_at)),
        accessedAt: new Date(Number(row.accessed_at)),
        accessCount: Number(row.access_count),
      }));
  }

  async forget(memoryId: string): Promise<void> {
    this.#db.prepare('delete from memories where id = ?').run(memoryId);
  }
}

class FileMemoryStore extends InMemoryPersistentMemoryStore {
  readonly #path: string;

  constructor(path: string) {
    super();
    this.#path = path;
  }

  async #readFile(): Promise<{
    sessions: Record<string, SessionRecord>;
    memories: MemoryRecord[];
  }> {
    try {
      const content = await fs.readFile(this.#path, 'utf-8');
      return JSON.parse(content) as {
        sessions: Record<string, SessionRecord>;
        memories: MemoryRecord[];
      };
    } catch {
      return { sessions: {}, memories: [] };
    }
  }

  async #writeFile(value: {
    sessions: Record<string, SessionRecord>;
    memories: MemoryRecord[];
  }) {
    await fs.mkdir(dirname(this.#path), { recursive: true });
    await fs.writeFile(this.#path, JSON.stringify(value, null, 2), 'utf-8');
  }

  override async getSession(sessionId: string): Promise<SessionRecord> {
    const file = await this.#readFile();
    return file.sessions[sessionId] ?? { messages: [], metadata: {} };
  }

  override async appendMessages(
    sessionId: string,
    messages: LLMMessage[],
  ): Promise<void> {
    const file = await this.#readFile();
    const session = file.sessions[sessionId] ?? { messages: [], metadata: {} };
    file.sessions[sessionId] = {
      messages: [...session.messages, ...messages],
      metadata: session.metadata,
    };
    await this.#writeFile(file);
  }

  override async mergeMetadata(
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const file = await this.#readFile();
    const session = file.sessions[sessionId] ?? { messages: [], metadata: {} };
    file.sessions[sessionId] = {
      messages: session.messages,
      metadata: { ...session.metadata, ...metadata },
    };
    await this.#writeFile(file);
  }

  override async clearSession(sessionId: string): Promise<void> {
    const file = await this.#readFile();
    delete file.sessions[sessionId];
    await this.#writeFile(file);
  }

  override async remember(
    memory: Omit<
      MemoryRecord,
      'id' | 'createdAt' | 'accessedAt' | 'accessCount'
    >,
  ): Promise<MemoryRecord> {
    const file = await this.#readFile();
    const record = await super.remember(memory);
    file.memories.push(record);
    await this.#writeFile(file);
    return record;
  }

  override async recall(
    query: string,
    options: RecallOptions = {},
  ): Promise<MemoryRecord[]> {
    const file = await this.#readFile();
    return file.memories
      .filter((record) => record.content.includes(query))
      .filter((record) =>
        options.sessionId ? record.sessionId === options.sessionId : true,
      )
      .filter((record) =>
        options.userId ? record.userId === options.userId : true,
      )
      .filter((record) => (options.type ? record.type === options.type : true))
      .slice(0, options.limit ?? 5);
  }

  override async forget(memoryId: string): Promise<void> {
    const file = await this.#readFile();
    file.memories = file.memories.filter((record) => record.id !== memoryId);
    await this.#writeFile(file);
  }
}

let memoryStore: PersistentMemoryStore = new InMemoryPersistentMemoryStore();

export function createMemoryPlugin(config: MemoryConfig): CocoPlugin {
  const rememberSchema = z.object({
    sessionId: z.string(),
    userId: z.string().optional(),
    type: z.enum(['fact', 'preference', 'context', 'conversation']),
    content: z.string(),
    importance: z.number().min(0).max(1).default(0.5),
  });
  const recallSchema = z.object({
    query: z.string(),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    type: z.enum(['fact', 'preference', 'context', 'conversation']).optional(),
    limit: z.number().optional(),
    minImportance: z.number().optional(),
  });
  const forgetSchema = z.object({
    memoryId: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'memory.remember',
      triggers: ['remember', 'memory'],
      description: 'Store a long-term memory record.',
      schema: rememberSchema,
      async execute(_ctx, params: z.infer<typeof rememberSchema>) {
        return {
          success: true,
          data: await memoryStore.remember({
            sessionId: params.sessionId,
            userId: params.userId,
            type: params.type,
            content: params.content,
            importance: params.importance,
          }),
        };
      },
    },
    {
      id: 'memory.recall',
      triggers: ['recall', 'memory'],
      description: 'Recall long-term memories using text search.',
      schema: recallSchema,
      async execute(_ctx, params: z.infer<typeof recallSchema>) {
        return {
          success: true,
          data: await memoryStore.recall(params.query, {
            sessionId: params.sessionId,
            userId: params.userId,
            type: params.type,
            limit: params.limit,
            minImportance: params.minImportance,
          }),
        };
      },
    },
    {
      id: 'memory.forget',
      triggers: ['forget', 'memory'],
      description: 'Forget a specific long-term memory.',
      schema: forgetSchema,
      async execute(_ctx, params: z.infer<typeof forgetSchema>) {
        await memoryStore.forget(params.memoryId);
        return { success: true, data: { memoryId: params.memoryId } };
      },
    },
  ];

  return {
    id: 'memory',
    name: 'Coco Memory',
    version: '1.2.0',
    description: 'Persistent message and long-term memory storage',
    async setup(runtime) {
      memoryStore =
        config.storage === 'sqlite'
          ? new SqliteMemoryStore(config.storagePath)
          : new FileMemoryStore(config.storagePath);
      runtime.memory = memoryStore;
    },
    tools,
  };
}

export const memoryPlugin = createMemoryPlugin({
  storage: 'sqlite',
  storagePath: 'coco-memory.sqlite',
});

export default memoryPlugin;
