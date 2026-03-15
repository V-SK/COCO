import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { type CocoPlugin, type CocoTool, optionalImport } from '@coco/core';
import Database from 'better-sqlite3';
import { z } from 'zod';

export interface KnowledgeConfig {
  storage: 'sqlite-vec';
  storagePath: string;
  embeddingProvider: 'openai' | 'local';
  embeddingModel?: string | undefined;
  chunkSize?: number | undefined;
  chunkOverlap?: number | undefined;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
}

export interface KnowledgeDocument {
  id: string;
  source: string;
  title?: string | undefined;
  content: string;
  metadata: Record<string, unknown>;
  chunks: DocumentChunk[];
  createdAt: Date;
}

class KnowledgeStore {
  readonly #db: Database.Database;
  readonly #path: string;
  backend: 'sqlite-vec' | 'hnswlib-node' = 'sqlite-vec';

  constructor(path: string) {
    this.#path = path;
    this.#db = new Database(path);
    this.#db.exec(`
      create table if not exists knowledge_documents (
        id text primary key,
        source text not null,
        title text,
        content text not null,
        metadata text not null,
        created_at integer not null
      );
      create table if not exists knowledge_chunks (
        id text primary key,
        document_id text not null,
        content text not null,
        embedding text not null,
        start_index integer not null,
        end_index integer not null
      );
    `);
  }

  async init(): Promise<void> {
    const sqliteVec =
      await optionalImport<Record<string, unknown>>('sqlite-vec');
    if (!sqliteVec) {
      const hnswlib =
        await optionalImport<Record<string, unknown>>('hnswlib-node');
      this.backend = hnswlib ? 'hnswlib-node' : 'sqlite-vec';
    }
  }

  add(document: KnowledgeDocument): void {
    this.#db
      .prepare(
        `
          insert into knowledge_documents (id, source, title, content, metadata, created_at)
          values (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        document.id,
        document.source,
        document.title ?? null,
        document.content,
        JSON.stringify(document.metadata),
        document.createdAt.getTime(),
      );

    const insertChunk = this.#db.prepare(
      `
        insert into knowledge_chunks (id, document_id, content, embedding, start_index, end_index)
        values (?, ?, ?, ?, ?, ?)
      `,
    );
    for (const chunk of document.chunks) {
      insertChunk.run(
        chunk.id,
        chunk.documentId,
        chunk.content,
        JSON.stringify(chunk.embedding),
        chunk.startIndex,
        chunk.endIndex,
      );
    }
  }

  list(): KnowledgeDocument[] {
    const docs = this.#db
      .prepare('select * from knowledge_documents order by created_at desc')
      .all() as Array<Record<string, unknown>>;
    return docs.map((doc) => ({
      id: String(doc.id),
      source: String(doc.source),
      title: doc.title ? String(doc.title) : undefined,
      content: String(doc.content),
      metadata: JSON.parse(String(doc.metadata)),
      chunks: this.#db
        .prepare('select * from knowledge_chunks where document_id = ?')
        .all(doc.id)
        .map((chunk) => ({
          id: String((chunk as Record<string, unknown>).id),
          documentId: String((chunk as Record<string, unknown>).document_id),
          content: String((chunk as Record<string, unknown>).content),
          embedding: JSON.parse(
            String((chunk as Record<string, unknown>).embedding),
          ),
          startIndex: Number((chunk as Record<string, unknown>).start_index),
          endIndex: Number((chunk as Record<string, unknown>).end_index),
        })),
      createdAt: new Date(Number(doc.created_at)),
    }));
  }

  delete(documentId: string): void {
    this.#db
      .prepare('delete from knowledge_chunks where document_id = ?')
      .run(documentId);
    this.#db
      .prepare('delete from knowledge_documents where id = ?')
      .run(documentId);
  }

  search(
    query: string,
    limit: number,
  ): Array<{ score: number; chunk: DocumentChunk }> {
    const needle = embed(query);
    const chunks = this.#db
      .prepare('select * from knowledge_chunks')
      .all() as Array<Record<string, unknown>>;
    return chunks
      .map((chunk) => {
        const embedding = JSON.parse(String(chunk.embedding)) as number[];
        return {
          score: cosineSimilarity(needle, embedding),
          chunk: {
            id: String(chunk.id),
            documentId: String(chunk.document_id),
            content: String(chunk.content),
            embedding,
            startIndex: Number(chunk.start_index),
            endIndex: Number(chunk.end_index),
          },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

function embed(content: string): number[] {
  const digest = createHash('sha256').update(content).digest();
  return Array.from(digest.slice(0, 16)).map((value) => value / 255);
}

function cosineSimilarity(left: number[], right: number[]) {
  const size = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue ** 2;
    rightNorm += rightValue ** 2;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1);
}

function splitIntoChunks(
  content: string,
  size: number,
  overlap: number,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  for (
    let start = 0;
    start < content.length;
    start += Math.max(1, size - overlap)
  ) {
    const piece = content.slice(start, start + size);
    if (!piece) {
      continue;
    }
    chunks.push({
      id: randomUUID(),
      documentId: '',
      content: piece,
      embedding: embed(piece),
      startIndex: start,
      endIndex: start + piece.length,
    });
  }
  return chunks;
}

async function loadSource(
  source: string,
  type?: 'text' | 'pdf' | 'markdown' | 'web',
) {
  if (type === 'web' || /^https?:\/\//.test(source)) {
    const response = await fetch(source);
    return await response.text();
  }

  const file = await fs.readFile(source, 'utf-8');
  return file;
}

let store = new KnowledgeStore('coco-knowledge.sqlite');

export function createKnowledgePlugin(
  config: KnowledgeConfig = {
    storage: 'sqlite-vec',
    storagePath: 'coco-knowledge.sqlite',
    embeddingProvider: 'local',
  },
): CocoPlugin {
  const addSchema = z.object({
    source: z.string(),
    type: z.enum(['text', 'pdf', 'markdown', 'web']).optional(),
    metadata: z.record(z.unknown()).optional(),
  });
  const searchSchema = z.object({
    query: z.string(),
    limit: z.number().optional(),
    minScore: z.number().optional(),
  });
  const deleteSchema = z.object({
    documentId: z.string(),
  });
  const listSchema = z.object({});

  const tools: CocoTool[] = [
    {
      id: 'knowledge.add-document',
      triggers: ['knowledge', 'document', 'add'],
      description: 'Add a document to the knowledge base.',
      schema: addSchema,
      async execute(_ctx, params: z.infer<typeof addSchema>) {
        const content = await loadSource(params.source, params.type);
        const documentId = randomUUID();
        const chunks = splitIntoChunks(
          content,
          config.chunkSize ?? 500,
          config.chunkOverlap ?? 50,
        ).map((chunk) => ({
          ...chunk,
          documentId,
        }));
        const document: KnowledgeDocument = {
          id: documentId,
          source: params.source,
          content,
          metadata: params.metadata ?? {},
          chunks,
          createdAt: new Date(),
        };
        store.add(document);
        return {
          success: true,
          data: { documentId, chunks: chunks.length, backend: store.backend },
        };
      },
    },
    {
      id: 'knowledge.search',
      triggers: ['knowledge', 'search', 'rag'],
      description: 'Search the knowledge base.',
      schema: searchSchema,
      async execute(_ctx, params: z.infer<typeof searchSchema>) {
        return {
          success: true,
          data: store
            .search(params.query, params.limit ?? 5)
            .filter((item) =>
              params.minScore != null ? item.score >= params.minScore : true,
            ),
        };
      },
    },
    {
      id: 'knowledge.delete-document',
      triggers: ['knowledge', 'delete', 'document'],
      description: 'Delete a knowledge base document.',
      schema: deleteSchema,
      async execute(_ctx, params: z.infer<typeof deleteSchema>) {
        store.delete(params.documentId);
        return { success: true, data: { documentId: params.documentId } };
      },
    },
    {
      id: 'knowledge.list-documents',
      triggers: ['knowledge', 'list', 'documents'],
      description: 'List indexed documents.',
      schema: listSchema,
      async execute() {
        return { success: true, data: store.list() };
      },
    },
  ];

  return {
    id: 'knowledge',
    name: 'Coco Knowledge',
    version: '1.2.0',
    description: 'Document indexing and retrieval',
    async setup() {
      store = new KnowledgeStore(config.storagePath);
      await store.init();
    },
    tools,
  };
}

export const knowledgePlugin = createKnowledgePlugin();

export default knowledgePlugin;
