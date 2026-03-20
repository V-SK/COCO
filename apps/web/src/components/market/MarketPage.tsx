import type { TickerData } from '@/hooks/useBinanceTickers';
import type { MemeToken } from '@/hooks/useDexTrending';
import { useDexTrending } from '@/hooks/useDexTrending';
import { ChainFilter } from './ChainFilter';
import { SortTabs } from './SortTabs';
import { MemeTokenList } from './MemeTokenList';
import { KlineSheet } from './KlineSheet';
import { useEffect, useRef, useState } from 'react';

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
function TvChart({ symbol, onClick }: { symbol: string; onClick: () => void }) {
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
    <div
      className="cursor-pointer overflow-hidden rounded-xl border border-border/30 bg-surface/30 transition-colors hover:border-primary/30"
      onClick={onClick}
    >
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

/* ── Main ── */
export function MarketPage({ tickers }: { tickers: TickerData[] }) {
  const [selectedTicker, setSelectedTicker] = useState<TickerData | null>(null);
  const [selectedMeme, setSelectedMeme] = useState<MemeToken | null>(null);

  const {
    tokens: memeTokens,
    chain,
    setChain,
    sort,
    setSort,
    loading: memeLoading,
    refreshing: memeRefreshing,
    refresh: memeRefresh,
  } = useDexTrending('bsc');

  const positive = tickers.filter((t) => t.change24h >= 0).length;
  const negative = tickers.length - positive;
  const totalVolume = tickers.reduce((sum, t) => sum + t.volume24h, 0);

  // Keep selected ticker's price updated
  const liveTicker = selectedTicker
    ? tickers.find((t) => t.symbol === selectedTicker.symbol) ?? selectedTicker
    : null;

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
            <TvChart
              symbol="BTC"
              onClick={() => setSelectedTicker(tickers.find((t) => t.symbol === 'BTC') ?? null)}
            />
            <TvChart
              symbol="ETH"
              onClick={() => setSelectedTicker(tickers.find((t) => t.symbol === 'ETH') ?? null)}
            />
          </div>
        ) : null}

        {/* ─── Meme Trending Section ─── */}
        <SectionDivider />

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
          tokens={memeTokens}
          loading={memeLoading}
          refreshing={memeRefreshing}
          onRefresh={memeRefresh}
          onTokenClick={(token) => setSelectedMeme(token)}
        />
      </div>

      {/* K-line sheet for Binance tokens (BTC/ETH) */}
      {liveTicker && (
        <KlineSheet
          ticker={liveTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}

      {/* K-line sheet for meme tokens (DexScreener) */}
      {selectedMeme && (
        <KlineSheet
          memeToken={selectedMeme}
          onClose={() => setSelectedMeme(null)}
        />
      )}
    </div>
  );
}
