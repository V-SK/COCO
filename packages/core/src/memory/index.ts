import { randomUUID } from 'node:crypto';
import type {
  LLMMessage,
  MemoryRecord,
  MemoryStore,
  PersistentMemoryStore,
  RecallOptions,
  SessionRecord,
  UUID,
} from '../types.js';

function cloneMessages(messages: LLMMessage[]): LLMMessage[] {
  return messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls?.map((call) => ({ ...call })),
  }));
}

export class InMemorySessionStore implements MemoryStore {
  readonly #sessions = new Map<UUID, SessionRecord>();

  async getSession(sessionId: UUID): Promise<SessionRecord> {
    const existing = this.#sessions.get(sessionId);
    if (!existing) {
      return { messages: [], metadata: {} };
    }

    return {
      messages: cloneMessages(existing.messages),
      metadata: { ...existing.metadata },
    };
  }

  async appendMessages(sessionId: UUID, messages: LLMMessage[]): Promise<void> {
    const existing = await this.getSession(sessionId);
    this.#sessions.set(sessionId, {
      messages: [...existing.messages, ...cloneMessages(messages)],
      metadata: existing.metadata,
    });
  }

  async mergeMetadata(
    sessionId: UUID,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.getSession(sessionId);
    this.#sessions.set(sessionId, {
      messages: existing.messages,
      metadata: { ...existing.metadata, ...metadata },
    });
  }

  async clearSession(sessionId: UUID): Promise<void> {
    this.#sessions.delete(sessionId);
  }
}

export class InMemoryPersistentMemoryStore
  extends InMemorySessionStore
  implements PersistentMemoryStore
{
  readonly #memories = new Map<string, MemoryRecord>();

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
    this.#memories.set(record.id, record);
    return { ...record };
  }

  async recall(
    query: string,
    options: RecallOptions = {},
  ): Promise<MemoryRecord[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const records = Array.from(this.#memories.values())
      .filter((record) =>
        options.sessionId ? record.sessionId === options.sessionId : true,
      )
      .filter((record) =>
        options.userId ? record.userId === options.userId : true,
      )
      .filter((record) => (options.type ? record.type === options.type : true))
      .filter((record) =>
        options.minImportance != null
          ? record.importance >= options.minImportance
          : true,
      )
      .filter((record) =>
        normalizedQuery.length === 0
          ? true
          : record.content.toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => b.importance - a.importance)
      .slice(0, options.limit ?? 5)
      .map((record) => ({
        ...record,
        accessCount: record.accessCount + 1,
        accessedAt: new Date(),
      }));

    for (const record of records) {
      this.#memories.set(record.id, record);
    }

    return records;
  }

  async forget(memoryId: string): Promise<void> {
    this.#memories.delete(memoryId);
  }
}
