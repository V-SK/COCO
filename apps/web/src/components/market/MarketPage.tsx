import type { TickerData } from '@/hooks/useBinanceTickers';
import { useEffect, useRef, useState } from 'react';

function CoinIcon({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

  if (failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {symbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={symbol}
      className="h-9 w-9 rounded-full bg-surface/50 object-contain p-1"
      onError={() => setFailed(true)}
    />
  );
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

/* ── Token row ── */
function TokenRow({ ticker, index }: { ticker: TickerData; index: number }) {
  const up = ticker.change24h >= 0;

  return (
    <div
      className="animate-fade-in-up flex items-center justify-between rounded-xl border border-border/30 bg-surface/30 px-4 py-3 transition-colors hover:bg-surface/60 [animation-fill-mode:backwards]"
      style={{ animationDelay: `${80 + index * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <CoinIcon symbol={ticker.symbol} />
        <div>
          <p className="text-sm font-semibold text-white">{ticker.symbol}</p>
          <p className="text-xs text-neutral-500">{ticker.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-semibold text-white">
          ${ticker.price < 1 ? ticker.price.toFixed(4) : ticker.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </p>
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${
            up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {up ? '↑' : '↓'} {up ? '+' : ''}{ticker.change24h.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* ── TradingView Chart ── */
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
      <div ref={ref} className="h-[180px] w-full" />
    </div>
  );
}

/* ── Main ── */
export function MarketPage({ tickers }: { tickers: TickerData[] }) {
  const positive = tickers.filter((t) => t.change24h >= 0).length;
  const negative = tickers.length - positive;
  const totalVolume = tickers.reduce((sum, t) => sum + t.volume24h, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="上涨" value={String(positive)} color="#34D399" icon="📈" delay={0} />
          <StatCard label="下跌" value={String(negative)} color="#F87171" icon="📉" delay={60} />
          <StatCard
            label="24h 量"
            value={`$${(totalVolume / 1e9).toFixed(1)}B`}
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

        {/* Token list */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-400">实时行情</h3>
          {tickers.map((ticker, i) => (
            <TokenRow key={ticker.symbol} ticker={ticker} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
