import { CocoError, normalizeSymbol } from '@coco/core';
import WebSocket from 'ws';

type PriceCacheEntry = {
  price: number;
  change24h: number | null;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  updatedAt: number;
};

export interface PriceSnapshot {
  price: number;
  change24h: number | null;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
}

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
    const snapshot = await this.getSnapshot(symbol);
    return snapshot.price;
  }

  async getSnapshot(symbol: string): Promise<PriceSnapshot> {
    const pair = this.normalizeInput(symbol);
    const cached = this.#cache.get(pair);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      return {
        price: cached.price,
        change24h: cached.change24h,
        changePercent24h: cached.changePercent24h,
        high24h: cached.high24h,
        low24h: cached.low24h,
      };
    }

    const response = await this.#fetch(
      `https://api.binance.us/api/v3/ticker/24hr?symbol=${pair}`,
    );
    if (!response.ok) {
      throw new CocoError(
        `Binance price lookup failed for ${pair}.`,
        'binance_price_failed',
      );
    }

    const payload = (await response.json()) as {
      lastPrice?: string;
      priceChange?: string;
      priceChangePercent?: string;
      highPrice?: string;
      lowPrice?: string;
    };
    const price = Number(payload.lastPrice);
    if (!Number.isFinite(price)) {
      throw new CocoError(
        `Binance returned an invalid price for ${pair}.`,
        'binance_price_invalid',
      );
    }

    const change24h = Number(payload.priceChange);
    const changePercent24h = Number(payload.priceChangePercent);
    const high24h = Number(payload.highPrice);
    const low24h = Number(payload.lowPrice);

    this.#cache.set(pair, {
      price,
      change24h: Number.isFinite(change24h) ? change24h : null,
      changePercent24h: Number.isFinite(changePercent24h)
        ? changePercent24h
        : null,
      high24h: Number.isFinite(high24h) ? high24h : null,
      low24h: Number.isFinite(low24h) ? low24h : null,
      updatedAt: Date.now(),
    });

    return {
      price,
      change24h: Number.isFinite(change24h) ? change24h : null,
      changePercent24h: Number.isFinite(changePercent24h)
        ? changePercent24h
        : null,
      high24h: Number.isFinite(high24h) ? high24h : null,
      low24h: Number.isFinite(low24h) ? low24h : null,
    };
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
        const previous = this.#cache.get(pair.toUpperCase());
        this.#cache.set(pair.toUpperCase(), {
          price,
          change24h: previous?.change24h ?? null,
          changePercent24h: previous?.changePercent24h ?? null,
          high24h: previous?.high24h ?? null,
          low24h: previous?.low24h ?? null,
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
