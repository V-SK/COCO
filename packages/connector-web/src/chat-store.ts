import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import Database from 'better-sqlite3';
import { Wallet } from 'ethers';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(blob: string, key: Buffer): string {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface CustodyWallet {
  sessionId: string;
  address: string;
  createdAt: number;
}

export class ChatStore {
  readonly #db: Database.Database;
  readonly #key: Buffer;

  constructor(dbPath: string, secretHex: string) {
    if (!secretHex || secretHex.length < 64) {
      throw new Error('COCO_CUSTODY_SECRET must be a 32-byte hex string (64 chars)');
    }
    this.#key = Buffer.from(secretHex, 'hex');
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);

      CREATE TABLE IF NOT EXISTS custody_wallets (
        session_id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  saveMessage(msg: ChatMessage): void {
    this.#db.prepare(
      'INSERT OR IGNORE INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(msg.id, msg.sessionId, msg.role, msg.content, msg.createdAt);
  }

  getMessages(sessionId: string, limit = 50, before?: number): ChatMessage[] {
    if (before) {
      return this.#db.prepare(
        'SELECT id, session_id AS sessionId, role, content, created_at AS createdAt FROM chat_messages WHERE session_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
      ).all(sessionId, before, limit) as ChatMessage[];
    }
    return this.#db.prepare(
      'SELECT id, session_id AS sessionId, role, content, created_at AS createdAt FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(sessionId, limit) as ChatMessage[];
  }

  createWallet(sessionId: string): { address: string; isNew: boolean } {
    const existing = this.#db.prepare(
      'SELECT address FROM custody_wallets WHERE session_id = ?'
    ).get(sessionId) as { address: string } | undefined;

    if (existing) {
      return { address: existing.address, isNew: false };
    }

    const wallet = Wallet.createRandom();
    const encryptedKey = encrypt(wallet.privateKey, this.#key);

    this.#db.prepare(
      'INSERT INTO custody_wallets (session_id, address, encrypted_key, created_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, wallet.address, encryptedKey, Date.now());

    return { address: wallet.address, isNew: true };
  }

  getWalletAddress(sessionId: string): string | null {
    const row = this.#db.prepare(
      'SELECT address FROM custody_wallets WHERE session_id = ?'
    ).get(sessionId) as { address: string } | undefined;
    return row?.address ?? null;
  }

  exportPrivateKey(sessionId: string): string | null {
    const row = this.#db.prepare(
      'SELECT encrypted_key FROM custody_wallets WHERE session_id = ?'
    ).get(sessionId) as { encrypted_key: string } | undefined;

    if (!row) return null;
    return decrypt(row.encrypted_key, this.#key);
  }

  close(): void {
    this.#db.close();
  }
}
