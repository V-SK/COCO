import { CocoError, normalizeSymbol } from '@coco/core';
import WebSocket from 'ws';

type PriceCacheEntry = {
  price: number;
  updatedAt: number;
};

const CACHE_TTL_MS = 10_000;

export class BinancePriceService {
  readonly #cache = new Map<string, PriceCacheEntry>();
  readonly #sockets = new Map<string, WebSocket>();
  readonly #fetch: typeof globalThis.fetch;

  constructor(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.#fetch = fetchImpl;
  }

  normalizeInput(symbol: string): string {
    const normalized = normalizeSymbol(symbol);
    if (normalized.endsWith('USDT')) {
      return normalized;
    }

    return `${normalized}USDT`;
  }

  async getPrice(symbol: string): Promise<number> {
    const pair = this.normalizeInput(symbol);
    const cached = this.#cache.get(pair);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return cached.price;
    }

    const response = await this.#fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
    );
    if (!response.ok) {
      throw new CocoError(
        `Binance price lookup failed for ${pair}.`,
        'binance_price_failed',
      );
    }

    const payload = (await response.json()) as { price?: string };
    const price = Number(payload.price);
    if (!Number.isFinite(price)) {
      throw new CocoError(
        `Binance returned an invalid price for ${pair}.`,
        'binance_price_invalid',
      );
    }

    this.#cache.set(pair, {
      price,
      updatedAt: Date.now(),
    });

    return price;
  }

  watchSymbol(symbol: string): void {
    const pair = this.normalizeInput(symbol).toLowerCase();
    if (this.#sockets.has(pair)) {
      return;
    }

    const socket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${pair}@trade`,
    );
    socket.on('message', (raw) => {
      const payload = JSON.parse(raw.toString()) as { p?: string };
      const price = Number(payload.p);
      if (Number.isFinite(price)) {
        this.#cache.set(pair.toUpperCase(), {
          price,
          updatedAt: Date.now(),
        });
      }
    });
    socket.on('error', () => {
      socket.close();
      this.#sockets.delete(pair);
    });
    socket.on('close', () => {
      this.#sockets.delete(pair);
    });

    this.#sockets.set(pair, socket);
  }

  close(): void {
    for (const socket of this.#sockets.values()) {
      socket.close();
    }
    this.#sockets.clear();
  }
}
