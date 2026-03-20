import type { TickerData } from '@/hooks/useBinanceTickers';
import type { PoolToken } from '@/hooks/useTrendingPools';
import { useTrendingPools, searchPools } from '@/hooks/useTrendingPools';
import { ChainFilter } from './ChainFilter';
import { SortTabs } from './SortTabs';
import { MemeTokenList } from './MemeTokenList';
import { TokenDetailPage } from './TokenDetailPage';
import { useCallback, useEffect, useRef, useState } from 'react';

function formatVolume(vol: number): string {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}万亿`;
  if (vol >= 1e8) return `$${(vol / 1e8).toFixed(1)}亿`;
  if (vol >= 1e4) return `$${(vol / 1e4).toFixed(1)}万`;
  return `$${vol.toFixed(0)}`;
}

/* ── Summary cards ── */
function StatCard({
  label,
  value,
  color,
  icon,
  delay,
}: {
  label: string;
  value: string;
  color: string;
  icon: string;
  delay: number;
}) {
  return (
    <div
      className="animate-fade-in-up relative overflow-hidden rounded-xl border border-border/50 bg-surface/50 px-4 py-3 [animation-fill-mode:backwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-3 -top-3 h-12 w-12 rounded-full opacity-20 blur-xl"
        style={{ background: color }}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
      <p className="mt-1.5 font-mono text-xl font-bold text-white" style={{ textShadow: `0 0 12px ${color}30` }}>
        {value}
      </p>
    </div>
  );
}

/* ── TradingView mini chart ── */
function TvChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.textContent = JSON.stringify({
      symbol: `BINANCE:${symbol}USDT`,
      width: '100%',
      height: '100%',
      locale: 'zh_CN',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
      noTimeScale: false,
    });
    ref.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/30 bg-surface/30">
      <div ref={ref} className="pointer-events-none h-[180px] w-full" />
    </div>
  );
}

/* ── Section Divider ── */
function SectionDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      <span className="text-[10px] font-medium tracking-wider text-neutral-600">MEME</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
    </div>
  );
}

/* ── Search Bar ── */
function SearchBar({
  onSearch,
  searching,
}: {
  onSearch: (query: string) => void;
  searching: boolean;
}) {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      clearTimeout(timerRef.current);
      const trimmed = v.trim();

      if (trimmed.length === 0) {
        onSearch('');
        return;
      }

      // Contract address: wait until ≥ 40 chars (full = 42)
      const isAddress = /^0x[a-fA-F0-9]/i.test(trimmed);
      if (isAddress) {
        if (trimmed.length >= 40) {
          timerRef.current = setTimeout(() => onSearch(trimmed), 150);
        }
        // Partial → wait for paste to complete
        return;
      }

      // Text search: debounce 500ms, min 2 chars
      if (trimmed.length >= 2) {
        timerRef.current = setTimeout(() => onSearch(trimmed), 500);
      }
    },
    [onSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && value.trim()) {
        clearTimeout(timerRef.current);
        onSearch(value.trim());
      }
    },
    [value, onSearch],
  );

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        {searching ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
        ) : (
          <span className="text-sm text-neutral-500">🔍</span>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="搜索合约地址 / 代币名称"
        className="w-full rounded-xl border border-border/40 bg-surface/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-600 focus:border-primary/50 focus:bg-surface/50 transition-all duration-200"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            onSearch('');
          }}
          className="absolute inset-y-0 right-3 flex items-center text-neutral-500 hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ── Main ── */
export function MarketPage({ tickers }: { tickers: TickerData[] }) {
  const [detailToken, setDetailToken] = useState<PoolToken | null>(null);
  const [searchResults, setSearchResults] = useState<PoolToken[] | null>(null);
  const [searching, setSearching] = useState(false);

  const {
    tokens: memeTokens,
    chain,
    setChain,
    sort,
    setSort,
    loading: memeLoading,
    refreshing: memeRefreshing,
    refresh: memeRefresh,
  } = useTrendingPools('bsc');

  const positive = tickers.filter((t) => t.change24h >= 0).length;
  const negative = tickers.length - positive;
  const totalVolume = tickers.reduce((sum, t) => sum + t.volume24h, 0);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query) {
        setSearchResults(null);
        return;
      }
      setSearching(true);
      try {
        const results = await searchPools(query, chain);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [chain],
  );

  /* Clear search when chain changes */
  useEffect(() => {
    setSearchResults(null);
  }, [chain]);

  const displayTokens = searchResults ?? memeTokens;

  /* Detail view — full screen slide-in */
  if (detailToken) {
    return (
      <TokenDetailPage
        token={detailToken}
        onBack={() => setDetailToken(null)}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="上涨" value={String(positive)} color="#34D399" icon="📈" delay={0} />
          <StatCard label="下跌" value={String(negative)} color="#F87171" icon="📉" delay={60} />
          <StatCard
            label="24h 量"
            value={formatVolume(totalVolume)}
            color="#F0B90B"
            icon="💰"
            delay={120}
          />
        </div>

        {/* Charts */}
        {tickers.length >= 2 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TvChart symbol="BTC" />
            <TvChart symbol="ETH" />
          </div>
        ) : null}

        {/* ─── Meme Trending Section ─── */}
        <SectionDivider />

        {/* Search bar */}
        <SearchBar onSearch={handleSearch} searching={searching} />

        {/* Chain filter */}
        <div className="flex items-center justify-between">
          <ChainFilter active={chain} onChange={setChain} />
          {memeRefreshing && (
            <div className="h-3 w-3 animate-spin rounded-full border border-primary/40 border-t-primary" />
          )}
        </div>

        {/* Sort tabs */}
        <SortTabs active={sort} onChange={setSort} />

        {/* Meme token list */}
        <MemeTokenList
          tokens={displayTokens}
          loading={searchResults === null ? memeLoading : searching}
          refreshing={memeRefreshing}
          onRefresh={memeRefresh}
          onTokenClick={(token) => setDetailToken(token)}
        />
      </div>
    </div>
  );
}
