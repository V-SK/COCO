import type { LLMMessage, MemoryStore, SessionRecord, UUID } from '../types.js';

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
