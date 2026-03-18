import type { TickerData } from '@/hooks/useBinanceTickers';
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

/* ── Fetch klines ── */
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

/* ── Component ── */
export function KlineSheet({
  ticker,
  onClose,
}: {
  ticker: TickerData;
  onClose: () => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volRef = useRef<any>(null);
  const [interval, setInterval_] = useState<Interval>('1h');
  const [loading, setLoading] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Touch-to-dismiss state
  const touchStartY = useRef(0);
  const dragging = useRef(false);

  const up = ticker.change24h >= 0;

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

      // v5 API: addSeries(SeriesDefinition, options)
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

      // Resize observer
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

  // Load data when interval changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchKlines(ticker.symbol, interval);
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
      setLoading(false);
    }

    const t = setTimeout(load, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ticker.symbol, interval]);

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
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 flex flex-col rounded-t-2xl border-t border-border/50 bg-background transition-transform duration-200"
        style={{ maxHeight: '75dvh' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-8 rounded-full bg-neutral-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={ticker.symbol} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{ticker.symbol}</span>
                <span className="text-xs text-neutral-500">/USDT</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-white">
                  ${ticker.price < 1 ? ticker.price.toFixed(6) : ticker.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`text-sm font-medium ${up ? 'text-success' : 'text-error'}`}
                >
                  {up ? '+' : ''}{ticker.change24h.toFixed(2)}%
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

        {/* Interval tabs */}
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

        {/* Chart */}
        <div className="relative flex-1 px-2 pb-4" style={{ minHeight: '320px' }}>
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          <div ref={chartContainerRef} className="h-full w-full" />
        </div>

        {/* Stats row */}
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
      </div>
    </div>
  );
}

/* ── Helpers ── */
function CoinIcon({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

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
      className="h-10 w-10 rounded-lg object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function formatVolume(vol: number): string {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(1)}万亿`;
  if (vol >= 1e8) return `$${(vol / 1e8).toFixed(1)}亿`;
  if (vol >= 1e4) return `$${(vol / 1e4).toFixed(1)}万`;
  return `$${vol.toFixed(0)}`;
}
