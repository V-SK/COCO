import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ── */
export type ChainId = 'bsc' | 'eth' | 'solana' | 'base';
export type SortMode = 'hot' | 'gainers' | 'mcap' | 'newest';

export interface PoolToken {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  pairCreatedAt: number;
  txBuys24h: number;
  txSells24h: number;
  chainId: ChainId;
  pairAddress: string;
  /* populated lazily */
  holders?: number;
  isHoneypot?: boolean;
  buyTax?: string;
  sellTax?: string;
}

/* GeckoTerminal chain path mapping */
const GECKO_CHAINS: Record<ChainId, string> = {
  bsc: 'bsc',
  eth: 'eth',
  solana: 'solana',
  base: 'base',
};

/* GoPlus chain IDs */
const GOPLUS_CHAIN_IDS: Record<ChainId, string> = {
  bsc: '56',
  eth: '1',
  solana: 'solana', // GoPlus doesn't fully support solana
  base: '8453',
};

/* ── 60s cache ── */
const cache = new Map<string, { data: PoolToken[]; ts: number }>();
const CACHE_TTL = 60_000;

/* ── Parse GeckoTerminal pool ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePool(pool: any, chain: ChainId): PoolToken | null {
  try {
    const attrs = pool.attributes;
    if (!attrs) return null;

    const price = parseFloat(attrs.base_token_price_usd || '0');
    if (price <= 0) return null;

    const baseAddr =
      pool.relationships?.base_token?.data?.id?.split('_')[1] || '';

    return {
      address: baseAddr,
      name: attrs.name || '',
      symbol: (attrs.name || '').split(' / ')[0] || '??',
      priceUsd: price,
      priceChange1h: parseFloat(attrs.price_change_percentage?.h1 || '0'),
      priceChange6h: parseFloat(attrs.price_change_percentage?.h6 || '0'),
      priceChange24h: parseFloat(attrs.price_change_percentage?.h24 || '0'),
      volume24h: parseFloat(attrs.volume_usd?.h24 || '0'),
      liquidity: parseFloat(attrs.reserve_in_usd || '0'),
      marketCap: parseFloat(attrs.market_cap_usd || '0'),
      fdv: parseFloat(attrs.fdv_usd || '0'),
      pairCreatedAt: attrs.pool_created_at
        ? new Date(attrs.pool_created_at).getTime()
        : 0,
      txBuys24h:
        (attrs.transactions?.h24?.buys ?? 0),
      txSells24h:
        (attrs.transactions?.h24?.sells ?? 0),
      chainId: chain,
      pairAddress: attrs.address || '',
    };
  } catch {
    return null;
  }
}

/* ── Fetch trending pools from GeckoTerminal ── */
async function fetchTrending(chain: ChainId): Promise<PoolToken[]> {
  const cacheKey = `trending:${chain}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const geckoChain = GECKO_CHAINS[chain];
  const url = `https://api.geckoterminal.com/api/v2/networks/${geckoChain}/trending_pools?page=1`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
  const json = await res.json();
  const pools: PoolToken[] = (json.data || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => parsePool(p, chain))
    .filter(Boolean) as PoolToken[];

  /* Fetch token images in batch */
  await enrichImages(pools, chain);

  cache.set(cacheKey, { data: pools, ts: Date.now() });
  return pools;
}

/* ── Fetch token images ── */
async function enrichImages(pools: PoolToken[], chain: ChainId) {
  const geckoChain = GECKO_CHAINS[chain];
  // Fetch top 10 token images concurrently
  const top = pools.slice(0, 15);
  const promises = top.map(async (pool) => {
    if (!pool.address) return;
    try {
      const res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/${geckoChain}/tokens/${pool.address}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) return;
      const json = await res.json();
      const imgUrl = json.data?.attributes?.image_url;
      if (imgUrl && imgUrl !== 'missing.png') {
        pool.imageUrl = imgUrl;
        // Also extract the real symbol/name
        const sym = json.data?.attributes?.symbol;
        const name = json.data?.attributes?.name;
        if (sym) pool.symbol = sym;
        if (name) pool.name = name;
      }
    } catch {
      /* ignore */
    }
  });
  await Promise.allSettled(promises);
}

/* ── Search pools ── */
export async function searchPools(
  query: string,
  chain: ChainId,
): Promise<PoolToken[]> {
  const geckoChain = GECKO_CHAINS[chain];
  const url = `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}&network=${geckoChain}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const pools = (json.data || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => parsePool(p, chain))
    .filter(Boolean) as PoolToken[];
  await enrichImages(pools, chain);
  return pools;
}

/* ── GoPlus security (lazy) ── */
export async function fetchGoPlus(
  address: string,
  chain: ChainId,
): Promise<{
  holders?: number;
  isHoneypot?: boolean;
  buyTax?: string;
  sellTax?: string;
  isOpenSource?: boolean;
} | null> {
  if (chain === 'solana') return null; // GoPlus doesn't support solana well
  const chainId = GOPLUS_CHAIN_IDS[chain];
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.result?.[address.toLowerCase()];
    if (!data) return null;
    return {
      holders: data.holder_count ? parseInt(data.holder_count) : undefined,
      isHoneypot: data.is_honeypot === '1',
      buyTax: data.buy_tax,
      sellTax: data.sell_tax,
      isOpenSource: data.is_open_source === '1',
    };
  } catch {
    return null;
  }
}

/* ── Sort ── */
function sortPools(pools: PoolToken[], mode: SortMode): PoolToken[] {
  const sorted = [...pools];
  switch (mode) {
    case 'hot':
      return sorted.sort((a, b) => b.volume24h - a.volume24h);
    case 'gainers':
      return sorted.sort((a, b) => b.priceChange24h - a.priceChange24h);
    case 'mcap':
      return sorted.sort(
        (a, b) => (b.marketCap || b.fdv) - (a.marketCap || a.fdv),
      );
    case 'newest':
      return sorted.sort((a, b) => b.pairCreatedAt - a.pairCreatedAt);
    default:
      return sorted;
  }
}

/* ── Hook ── */
export function useTrendingPools(initialChain: ChainId = 'bsc') {
  const [tokens, setTokens] = useState<PoolToken[]>([]);
  const [chain, setChain] = useState<ChainId>(initialChain);
  const [sort, setSort] = useState<SortMode>('hot');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const pools = await fetchTrending(chain);
        setTokens(pools);
      } catch (err) {
        console.error('[useTrendingPools] fetch error:', chain, err);
        /* keep stale */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [chain],
  );

  /* Re-fetch when chain changes */
  useEffect(() => {
    // Clear tokens immediately for visual feedback
    setTokens([]);
    setLoading(true);
    fetchAll();
    intervalRef.current = setInterval(() => fetchAll(true), 60_000);
    return () => clearInterval(intervalRef.current);
  }, [chain]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = sortPools(tokens, sort);

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
