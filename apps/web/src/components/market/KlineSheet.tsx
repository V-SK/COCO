import type { TickerData } from '@/hooks/useBinanceTickers';
import type { MemeToken } from '@/hooks/useDexTrending';
import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  CandlestickData,
  HistogramData,
  Time,
} from 'lightweight-charts';

/* ── Types ── */
type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

interface BinanceKline {
  0: number; // open time
  1: string; // open
  2: string; // high
  3: string; // low
  4: string; // close
  5: string; // volume
  6: number; // close time
}

const INTERVALS: { label: string; value: Interval }[] = [
  { label: '1分', value: '1m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '1时', value: '1h' },
  { label: '4时', value: '4h' },
  { label: '日', value: '1D' },
];

const REST_URLS = [
  'https://api.binance.us/api/v3/klines',
  'https://api.binance.com/api/v3/klines',
];

/* ── Copy toast ── */
function CopyToast({ visible }: { visible: boolean }) {
  return (
    <div
      className={`
        fixed left-1/2 top-16 z-[60] -translate-x-1/2
        rounded-lg bg-success/90 px-4 py-2 text-sm font-medium text-white shadow-lg
        transition-all duration-300
        ${visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}
      `}
    >
      ✓ 已复制
    </div>
  );
}

/* ── Fetch klines (Binance) ── */
async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit = 200,
): Promise<Array<CandlestickData & { _vol: number }>> {
  const pair = `${symbol}USDT`;
  const iv = interval === '1D' ? '1d' : interval;

  for (const base of REST_URLS) {
    try {
      const url = `${base}?symbol=${pair}&interval=${iv}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw: BinanceKline[] = await res.json();
      return raw.map((k) => ({
        time: (Math.floor(k[0] / 1000)) as Time,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        _vol: parseFloat(k[5]),
      }));
    } catch {
      /* try next */
    }
  }
  return [];
}

/* ── Helpers ── */
function formatVolume(vol: number): string {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}万亿`;
  if (vol >= 1e8) return `$${(vol / 1e8).toFixed(1)}亿`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e4) return `$${(vol / 1e4).toFixed(1)}万`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

function formatAge(timestamp: number): string {
  if (!timestamp) return '?';
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function CoinIcon({ symbol, imageUrl }: { symbol: string; imageUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl || `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

  if (failed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {symbol.slice(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={symbol}
      className="h-10 w-10 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/* ── DexScreener Embed (for meme tokens) ── */
function DexScreenerEmbed({ chainId, address }: { chainId: string; address: string }) {
  const [loaded, setLoaded] = useState(false);

  /* Map chainId to DexScreener path */
  const chainPath =
    chainId === 'bsc'
      ? 'bsc'
      : chainId === 'ethereum'
        ? 'ethereum'
        : chainId === 'solana'
          ? 'solana'
          : chainId === 'base'
            ? 'base'
            : chainId;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <iframe
        src={`https://dexscreener.com/${chainPath}/${address}?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`}
        className="h-full w-full border-0"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onLoad={() => setLoaded(true)}
        title="DexScreener Chart"
        allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}

/* ── Binance KlineSheet ── */
function BinanceChart({
  symbol,
  interval,
  onLoaded,
}: {
  symbol: string;
  interval: Interval;
  onLoaded: () => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volRef = useRef<any>(null);

  // Create chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let cancelled = false;

    (async () => {
      const lc = await import('lightweight-charts');
      if (cancelled || !chartContainerRef.current) return;

      const chart = lc.createChart(chartContainerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: 'transparent' },
          textColor: '#9CA3AF',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(240,185,11,0.3)', labelBackgroundColor: '#F0B90B' },
          horzLine: { color: 'rgba(240,185,11,0.3)', labelBackgroundColor: '#F0B90B' },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          scaleMargins: { top: 0.05, bottom: 0.2 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: { time: true, price: false } },
      });

      const candles = chart.addSeries(lc.CandlestickSeries, {
        upColor: '#34D399',
        downColor: '#F87171',
        borderUpColor: '#34D399',
        borderDownColor: '#F87171',
        wickUpColor: '#34D399',
        wickDownColor: '#F87171',
      });

      const vol = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
      });

      vol.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      chartRef.current = chart;
      candleRef.current = candles;
      volRef.current = vol;

      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      });
      ro.observe(chartContainerRef.current!);

      return () => {
        ro.disconnect();
        chart.remove();
      };
    })();

    return () => {
      cancelled = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  // Load data when interval or symbol changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchKlines(symbol, interval);
      if (cancelled || !candleRef.current || !volRef.current) return;

      const candles: CandlestickData[] = data.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const vols: HistogramData[] = data.map((d) => ({
        time: d.time,
        value: d._vol,
        color: d.close >= d.open ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)',
      }));

      candleRef.current.setData(candles);
      volRef.current.setData(vols);
      chartRef.current?.timeScale().fitContent();
      onLoaded();
    }

    const t = setTimeout(load, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [symbol, interval, onLoaded]);

  return <div ref={chartContainerRef} className="h-full w-full" />;
}

/* ── Component ── */
export function KlineSheet({
  ticker,
  memeToken,
  onClose,
}: {
  ticker?: TickerData;
  memeToken?: MemeToken;
  onClose: () => void;
}) {
  const isMeme = !!memeToken;
  const [interval, setInterval_] = useState<Interval>('1h');
  const [loading, setLoading] = useState(true);
  const [copyToast, setCopyToast] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Touch-to-dismiss state
  const touchStartY = useRef(0);
  const dragging = useRef(false);

  // Derive display info from either source
  const symbol = ticker?.symbol ?? memeToken?.symbol ?? '??';
  const name = ticker?.name ?? memeToken?.name ?? '';
  const price = ticker?.price ?? memeToken?.priceUsd ?? 0;
  const change = ticker?.change24h ?? memeToken?.priceChange24h ?? 0;
  const up = change >= 0;
  const imageUrl = memeToken?.imageUrl;

  const handleChartLoaded = useCallback(() => setLoading(false), []);

  /* Copy contract address */
  const copyContract = useCallback(async () => {
    if (!memeToken?.address) return;
    try {
      await navigator.clipboard.writeText(memeToken.address);
    } catch {
      /* Fallback for older browsers */
      const ta = document.createElement('textarea');
      ta.value = memeToken.address;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 1500);
  }, [memeToken?.address]);

  // Slide-down to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      if (backdropRef.current) {
        backdropRef.current.style.opacity = String(Math.max(0, 1 - dy / 300));
      }
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging.current || !sheetRef.current) return;
      dragging.current = false;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (dy > 100) {
        onClose();
      } else {
        sheetRef.current.style.transform = '';
        if (backdropRef.current) backdropRef.current.style.opacity = '1';
      }
    },
    [onClose],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <CopyToast visible={copyToast} />

      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm kline-backdrop-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 flex flex-col rounded-t-2xl border-t border-border/50 bg-background kline-slide-up transition-transform"
        style={{ maxHeight: '80dvh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-8 rounded-full bg-neutral-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={symbol} imageUrl={imageUrl} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{symbol}</span>
                {isMeme ? (
                  <span className="text-[11px] text-neutral-500">{name}</span>
                ) : (
                  <span className="text-xs text-neutral-500">/USDT</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-white">
                  ${price < 1
                    ? price < 0.000001
                      ? price.toExponential(2)
                      : price.toFixed(6)
                    : price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`text-sm font-medium ${up ? 'text-success' : 'text-error'}`}
                >
                  {up ? '+' : ''}{change.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-surface/60 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contract address bar for meme tokens */}
        {isMeme && memeToken && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-surface/40 px-3 py-1.5">
            <span className="text-[10px] text-neutral-500">合约</span>
            <span className="flex-1 font-mono text-[11px] text-neutral-300 select-all">
              {truncateAddress(memeToken.address)}
            </span>
            <button
              type="button"
              onClick={copyContract}
              className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              复制合约
            </button>
          </div>
        )}

        {/* Interval tabs (only for Binance tokens) */}
        {!isMeme && (
          <div className="flex gap-1 px-4 pb-3">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                type="button"
                onClick={() => setInterval_(iv.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  interval === iv.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="relative flex-1 px-2 pb-2" style={{ minHeight: isMeme ? '360px' : '320px' }}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {isMeme && memeToken ? (
            <DexScreenerEmbed chainId={memeToken.chainId} address={memeToken.pairAddress || memeToken.address} />
          ) : ticker ? (
            <BinanceChart symbol={ticker.symbol} interval={interval} onLoaded={handleChartLoaded} />
          ) : null}
        </div>

        {/* Stats row */}
        {isMeme && memeToken ? (
          <div className="grid grid-cols-4 gap-2 border-t border-border/30 px-4 py-3">
            <div>
              <p className="text-[10px] text-neutral-500">流动性</p>
              <p className="font-mono text-xs text-white">{formatVolume(memeToken.liquidity)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">市值</p>
              <p className="font-mono text-xs text-white">{formatVolume(memeToken.marketCap)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">24h 量</p>
              <p className="font-mono text-xs text-white">{formatVolume(memeToken.volume24h)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">创建</p>
              <p className="font-mono text-xs text-white">{formatAge(memeToken.pairCreatedAt)}</p>
            </div>
          </div>
        ) : ticker ? (
          <div className="grid grid-cols-4 gap-2 border-t border-border/30 px-4 py-3">
            <div>
              <p className="text-[10px] text-neutral-500">24h 高</p>
              <p className="font-mono text-xs text-white">
                ${ticker.high24h < 1 ? ticker.high24h.toFixed(4) : ticker.high24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">24h 低</p>
              <p className="font-mono text-xs text-white">
                ${ticker.low24h < 1 ? ticker.low24h.toFixed(4) : ticker.low24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">24h 量</p>
              <p className="font-mono text-xs text-white">{formatVolume(ticker.volume24h)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500">振幅</p>
              <p className="font-mono text-xs text-white">
                {ticker.high24h > 0
                  ? (((ticker.high24h - ticker.low24h) / ticker.low24h) * 100).toFixed(2)
                  : '0.00'}
                %
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
