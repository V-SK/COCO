import { useEffect, useRef, useState } from 'react';

/* ── Performance stat card ── */
function PerfCard({
  label,
  value,
  icon,
  color,
  delay,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  delay: number;
}) {
  return (
    <div
      className="animate-fade-in-up relative min-w-[130px] overflow-hidden rounded-xl border border-border/50 bg-surface/50 px-4 py-3 [animation-fill-mode:backwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-15 blur-xl"
        style={{ background: color }}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
      <p
        className="mt-1.5 font-mono text-lg font-bold"
        style={{ color, textShadow: `0 0 10px ${color}20` }}
      >
        {value}
      </p>
    </div>
  );
}

/* ── TradingView advanced chart ── */
function TvFullChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      symbol: `BINANCE:${symbol}USDT`,
      width: '100%',
      height: '100%',
      locale: 'zh_CN',
      interval: timeframe,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      gridColor: 'rgba(255, 255, 255, 0.03)',
      hide_top_toolbar: true,
      hide_legend: true,
      save_image: false,
      allow_symbol_change: false,
      autosize: true,
    });
    ref.current.appendChild(script);
  }, [symbol, timeframe]);

  return <div ref={ref} className="h-[280px] w-full sm:h-[320px]" />;
}

/* ── Timeframe selector ── */
const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D' },
];

/* ── Main ── */
export function TradingPage() {
  const [timeframe, setTimeframe] = useState('15');

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Performance stats */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <PerfCard label="总收益率" value="--" icon="📊" color="#34D399" delay={0} />
          <PerfCard label="胜率" value="--" icon="🎯" color="#F0B90B" delay={60} />
          <PerfCard label="交易次数" value="--" icon="📈" color="#60A5FA" delay={120} />
          <PerfCard label="最大回撤" value="--" icon="📉" color="#FBBF24" delay={180} />
        </div>

        {/* Notice */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs leading-5 text-neutral-400">
            <span className="mr-1 text-primary">✨</span>
            AI 交易功能即将上线。绑定交易账户后，这里将显示你的实时交易数据和 AI 策略表现。
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex gap-1.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setTimeframe(tf.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                timeframe === tf.value
                  ? 'bg-primary text-black'
                  : 'bg-surface/50 text-neutral-400 hover:bg-surface hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Charts */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border/30 bg-surface/20">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm font-medium text-white">BTC/USDT</span>
            </div>
            <TvFullChart symbol="BTC" timeframe={timeframe} />
          </div>

          <div className="overflow-hidden rounded-xl border border-border/30 bg-surface/20">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm font-medium text-white">ETH/USDT</span>
            </div>
            <TvFullChart symbol="ETH" timeframe={timeframe} />
          </div>
        </div>
      </div>
    </div>
  );
}
