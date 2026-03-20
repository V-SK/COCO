import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ── */
export type ChainId = 'bsc' | 'ethereum' | 'solana' | 'base';
export type SortMode = 'hot' | 'gainers' | 'mcap' | 'newest';

export interface MemeToken {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  pairCreatedAt: number;
  holders?: number;
  chainId: string;
  pairAddress?: string;
  dexId?: string;
}

/* Chain-specific search queries to find active meme tokens */
const CHAIN_QUERIES: Record<ChainId, string[]> = {
  bsc: ['pepe bsc', 'doge bsc', 'shib bsc', 'ai bsc', 'cat bsc', 'meme bsc'],
  ethereum: ['pepe', 'wojak', 'mog ethereum', 'brett ethereum', 'ai ethereum'],
  solana: ['bonk solana', 'wif solana', 'popcat solana', 'ai solana', 'pump solana'],
  base: ['brett base', 'toshi base', 'degen base', 'ai base', 'meme base'],
};

/* Deduplicate by token address, keep highest volume pair */
function dedup(tokens: MemeToken[]): MemeToken[] {
  const map = new Map<string, MemeToken>();
  for (const t of tokens) {
    const key = `${t.chainId}:${t.address.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing || t.volume24h > existing.volume24h) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}

/* Sort tokens */
function sortTokens(tokens: MemeToken[], mode: SortMode): MemeToken[] {
  const sorted = [...tokens];
  switch (mode) {
    case 'hot':
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
    case 'gainers':
      return sorted.sort((a, b) => b.priceChange24h - a.priceChange24h);
    case 'mcap':
      return sorted.sort((a, b) => b.marketCap - a.marketCap);
    case 'newest':
      return sorted.sort((a, b) => b.pairCreatedAt - a.pairCreatedAt);
    default:
      return sorted;
  }
}

/* Parse DexScreener pair into MemeToken */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePair(pair: any): MemeToken | null {
  try {
    const base = pair.baseToken;
    if (!base?.address || !base?.symbol) return null;
    const price = parseFloat(pair.priceUsd || '0');
    if (price <= 0) return null;

    return {
      address: base.address,
      name: base.name || base.symbol,
      symbol: base.symbol,
      imageUrl: pair.info?.imageUrl || undefined,
      priceUsd: price,
      priceChange1h: pair.priceChange?.h1 ?? 0,
      priceChange24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      marketCap: pair.fdv ?? 0,
      pairCreatedAt: pair.pairCreatedAt ?? 0,
      chainId: pair.chainId,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId,
    };
  } catch {
    return null;
  }
}

/* Fetch from DexScreener search */
async function fetchBySearch(chainId: ChainId): Promise<MemeToken[]> {
  const queries = CHAIN_QUERIES[chainId];
  const results: MemeToken[] = [];

  /* Fire all queries concurrently, take what we get */
  const fetches = queries.map(async (q) => {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const pairs = data.pairs || [];
      return pairs
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) =>
            p.chainId === chainId &&
            (p.volume?.h24 ?? 0) > 100 &&
            (p.liquidity?.usd ?? 0) > 500,
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => parsePair(p))
        .filter(Boolean) as MemeToken[];
    } catch {
      return [];
    }
  });

  const batches = await Promise.all(fetches);
  for (const batch of batches) results.push(...batch);

  return dedup(results);
}

/* Also try boosted tokens */
async function fetchBoosted(chainId: ChainId): Promise<MemeToken[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    const chainTokens = data.filter((t) => t.chainId === chainId);

    if (chainTokens.length === 0) return [];

    /* Batch fetch token details (max 30 addresses per call) */
    const addresses = chainTokens.map((t) => t.tokenAddress).slice(0, 30);
    const detailRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`,
    );
    if (!detailRes.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detailData: any = await detailRes.json();
    const pairs = detailData.pairs || [];

    return pairs
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.chainId === chainId,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => parsePair(p))
      .filter(Boolean) as MemeToken[];
  } catch {
    return [];
  }
}

/* Also try the profiles endpoint */
async function fetchProfiles(chainId: ChainId): Promise<MemeToken[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    const chainTokens = data.filter((t) => t.chainId === chainId);

    if (chainTokens.length === 0) return [];

    const addresses = chainTokens.map((t) => t.tokenAddress).slice(0, 30);
    const detailRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`,
    );
    if (!detailRes.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detailData: any = await detailRes.json();
    const pairs = detailData.pairs || [];

    return pairs
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.chainId === chainId,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => parsePair(p))
      .filter(Boolean) as MemeToken[];
  } catch {
    return [];
  }
}

/* ── Hook ── */
export function useDexTrending(initialChain: ChainId = 'bsc') {
  const [tokens, setTokens] = useState<MemeToken[]>([]);
  const [chain, setChain] = useState<ChainId>(initialChain);
  const [sort, setSort] = useState<SortMode>('hot');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      /* Cancel any in-flight */
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const [searchResults, boostedResults, profileResults] = await Promise.all([
          fetchBySearch(chain),
          fetchBoosted(chain),
          fetchProfiles(chain),
        ]);

        const all = dedup([...searchResults, ...boostedResults, ...profileResults]);

        /* Filter: must have some volume and liquidity */
        const filtered = all.filter(
          (t) => t.volume24h > 50 && t.liquidity > 200 && t.marketCap > 0,
        );

        setTokens(filtered);
      } catch {
        /* keep stale data */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [chain],
  );

  /* Fetch on chain change */
  useEffect(() => {
    fetchAll();

    /* Refresh every 60s */
    intervalRef.current = setInterval(() => fetchAll(true), 60_000);

    return () => {
      clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [fetchAll]);

  /* Sorted result */
  const sorted = sortTokens(tokens, sort);

  return {
    tokens: sorted,
    chain,
    setChain,
    sort,
    setSort,
    loading,
    refreshing,
    refresh: () => fetchAll(true),
  };
}
