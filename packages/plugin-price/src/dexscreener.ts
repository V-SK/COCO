import { CocoError } from '@coco/core';

export interface DexPairData {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  volume: { h24: number; h6: number; h1: number; m5: number };
  priceChange: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface DexTokenReport {
  symbol: string;
  name: string;
  address: string;
  priceUsd: number;
  change24h: number;
  change1h: number;
  change5m: number;
  volume24h: number;
  volume1h: number;
  liquidityUsd: number;
  fdv: number;
  marketCap: number;
  buys24h: number;
  sells24h: number;
  buys1h: number;
  sells1h: number;
  pairAddress: string;
  dex: string;
  pairCreatedAt: number;
  websites: string[];
  socials: { type: string; url: string }[];
}

export class DexScreenerService {
  readonly #fetch: typeof globalThis.fetch;

  constructor(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.#fetch = fetchImpl;
  }

  async getTokenByAddress(
    address: string,
    chain = 'bsc',
  ): Promise<DexTokenReport> {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const res = await this.#fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new CocoError(
        `DexScreener API failed: ${res.status}`,
        'dexscreener_failed',
      );
    }

    const data = (await res.json()) as { pairs: DexPairData[] | null };
    if (!data.pairs || data.pairs.length === 0) {
      throw new CocoError(
        `No DEX pair found for ${address}`,
        'dexscreener_no_pair',
      );
    }

    // Filter to requested chain, pick highest liquidity pair
    const chainPairs = data.pairs.filter(
      (p) => p.chainId === chain || chain === 'all',
    );
    const pairs = chainPairs.length > 0 ? chainPairs : data.pairs;
    const best = pairs.sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    )[0]!;

    return {
      symbol: best.baseToken.symbol,
      name: best.baseToken.name,
      address: best.baseToken.address,
      priceUsd: Number(best.priceUsd) || 0,
      change24h: best.priceChange?.h24 ?? 0,
      change1h: best.priceChange?.h1 ?? 0,
      change5m: best.priceChange?.m5 ?? 0,
      volume24h: best.volume?.h24 ?? 0,
      volume1h: best.volume?.h1 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      fdv: best.fdv ?? 0,
      marketCap: best.marketCap ?? 0,
      buys24h: best.txns?.h24?.buys ?? 0,
      sells24h: best.txns?.h24?.sells ?? 0,
      buys1h: best.txns?.h1?.buys ?? 0,
      sells1h: best.txns?.h1?.sells ?? 0,
      pairAddress: best.pairAddress,
      dex: best.dexId,
      pairCreatedAt: best.pairCreatedAt ?? 0,
      websites: best.info?.websites?.map((w) => w.url) ?? [],
      socials:
        best.info?.socials?.map((s) => ({ type: s.type, url: s.url })) ?? [],
    };
  }

  async searchToken(query: string): Promise<DexTokenReport[]> {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res = await this.#fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new CocoError(
        `DexScreener search failed: ${res.status}`,
        'dexscreener_search_failed',
      );
    }

    const data = (await res.json()) as { pairs: DexPairData[] | null };
    if (!data.pairs || data.pairs.length === 0) {
      return [];
    }

    // Deduplicate by base token address, keep highest liquidity
    const seen = new Map<string, DexPairData>();
    for (const pair of data.pairs) {
      const key = `${pair.chainId}:${pair.baseToken.address}`;
      const existing = seen.get(key);
      if (
        !existing ||
        (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)
      ) {
        seen.set(key, pair);
      }
    }

    return [...seen.values()].slice(0, 5).map((p) => ({
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      address: p.baseToken.address,
      priceUsd: Number(p.priceUsd) || 0,
      change24h: p.priceChange?.h24 ?? 0,
      change1h: p.priceChange?.h1 ?? 0,
      change5m: p.priceChange?.m5 ?? 0,
      volume24h: p.volume?.h24 ?? 0,
      volume1h: p.volume?.h1 ?? 0,
      liquidityUsd: p.liquidity?.usd ?? 0,
      fdv: p.fdv ?? 0,
      marketCap: p.marketCap ?? 0,
      buys24h: p.txns?.h24?.buys ?? 0,
      sells24h: p.txns?.h24?.sells ?? 0,
      buys1h: p.txns?.h1?.buys ?? 0,
      sells1h: p.txns?.h1?.sells ?? 0,
      pairAddress: p.pairAddress,
      dex: p.dexId,
      pairCreatedAt: p.pairCreatedAt ?? 0,
      websites: p.info?.websites?.map((w) => w.url) ?? [],
      socials:
        p.info?.socials?.map((s) => ({ type: s.type, url: s.url })) ?? [],
    }));
  }
}
