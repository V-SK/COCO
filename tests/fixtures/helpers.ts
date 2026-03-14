import type { LimitLedger, LimitRecord, WalletLimits } from '@coco/core';
import { vi } from 'vitest';

export function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
    },
  });
}

export function createNoopLedger(): LimitLedger {
  return {
    async getDailyTotal() {
      return 0;
    },
    async ensureWithinLimits(_input: {
      subjectId: string;
      amountUsd: number;
      limits: WalletLimits;
    }) {},
    async record(_entry: LimitRecord) {},
    async close() {},
  };
}

export function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function mockFetchOnce(
  implementations: Array<
    (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Response | Promise<Response>
  >,
) {
  let index = 0;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const implementation =
      implementations[index] ?? implementations[implementations.length - 1];
    if (!implementation) {
      throw new Error('No mock fetch implementations were provided.');
    }
    index += 1;
    return implementation(input, init);
  });
}
