import type { PoolToken } from '@/hooks/useTrendingPools';
import { fetchGoPlus } from '@/hooks/useTrendingPools';
import { useUiStore } from '@/stores/uiStore';
import { useCallback, useEffect, useState } from 'react';

/* ── Helpers ── */
function truncAddr(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtCompact(n: number): string {
  if (!n || n === 0) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.001) return `$${price.toFixed(6)}`;
  if (price >= 0.000001) return `$${price.toFixed(8)}`;
  const str = price.toFixed(18);
  const match = str.match(/^0\.(0+)([1-9]\d{0,3})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2];
    return `$0.0₍${zeros}₎${sig}`;
  }
  return `$${price.toExponential(2)}`;
}

/* Map chain to DexScreener path */
const DEX_CHAIN_MAP: Record<string, string> = {
  bsc: 'bsc',
  eth: 'ethereum',
  solana: 'solana',
  base: 'base',
};

/* ── Copy Toast ── */
function CopyToast({ visible }: { visible: boolean }) {
  return (
    <div
      className={`
        fixed left-1/2 top-16 z-[70] -translate-x-1/2
        rounded-lg bg-success/90 px-4 py-2 text-sm font-medium text-white shadow-lg
        transition-all duration-300
        ${visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}
      `}
    >
      ✓ 已复制
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="flex-shrink-0 snap-start rounded-xl border border-border/30 bg-surface/30 px-4 py-3 min-w-[120px]">
      <div className="flex items-center gap-1.5 text-neutral-500">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px]">{label}</span>
      </div>
      <p
        className="mt-1 font-mono text-sm font-bold text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p>}
    </div>
  );
}

/* ── Token Avatar ── */
function TokenAvatar({ token }: { token: PoolToken }) {
  const [failed, setFailed] = useState(false);

  if (!token.imageUrl || failed) {
    let hash = 0;
    for (let i = 0; i < token.symbol.length; i++) {
      hash = token.symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${hue + 30}, 50%, 25%))`,
        }}
      >
        {token.symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={token.imageUrl}
      alt={token.symbol}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/* ── Main Component ── */
export function TokenDetailPage({
  token,
  onBack,
}: {
  token: PoolToken;
  onBack: () => void;
}) {
  const [copyToast, setCopyToast] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [goplus, setGoplus] = useState<{
    holders?: number;
    isHoneypot?: boolean;
    buyTax?: string;
    sellTax?: string;
  } | null>(null);
  const [goplusLoading, setGoplusLoading] = useState(true);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  const up = token.priceChange24h >= 0;
  const dexChain = DEX_CHAIN_MAP[token.chainId] || token.chainId;
  const embedAddr = token.pairAddress || token.address;

  /* Lazy-load GoPlus */
  useEffect(() => {
    let cancelled = false;
    setGoplusLoading(true);
    fetchGoPlus(token.address, token.chainId).then((data) => {
      if (!cancelled) {
        setGoplus(data);
        setGoplusLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token.address, token.chainId]);

  const copyContract = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token.address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = token.address;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 1500);
  }, [token.address]);

  const goToChat = useCallback(() => {
    setActiveTab('chat');
  }, [setActiveTab]);

  /* Security status label */
  let securityLabel = '检测中…';
  let securityColor = '#9CA3AF';
  if (!goplusLoading && goplus) {
    if (goplus.isHoneypot) {
      securityLabel = '⚠️ 蜜罐';
      securityColor = '#F87171';
    } else {
      securityLabel = '✅ 安全';
      securityColor = '#34D399';
    }
  } else if (!goplusLoading && !goplus) {
    securityLabel = '未知';
  }

  return (
    <div className="detail-slide-in fixed inset-0 z-50 flex flex-col bg-background">
      <CopyToast visible={copyToast} />

      {/* Header */}
      <div className="native-status-pad flex items-center gap-3 border-b border-border/30 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-surface/60 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-xs">返回</span>
        </button>

        <TokenAvatar token={token} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-bold text-white">
              {token.symbol}
            </span>
            <span className="truncate text-xs text-neutral-500">{token.name}</span>
          </div>
          <button
            type="button"
            onClick={copyContract}
            className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-primary transition-colors"
          >
            <span className="font-mono">{truncAddr(token.address)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Price display */}
      <div className="px-4 py-3">
        <p className="font-mono text-3xl font-bold text-white">
          {fmtPrice(token.priceUsd)}
        </p>
        <span
          className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold ${
            up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {up ? '▲' : '▼'} {up ? '+' : ''}
          {token.priceChange24h.toFixed(2)}%
        </span>
      </div>

      {/* Metrics row — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide snap-x snap-mandatory">
        <MetricCard
          label="市值"
          value={fmtCompact(token.marketCap || token.fdv)}
          icon="💰"
        />
        <MetricCard
          label="池子"
          value={fmtCompact(token.liquidity)}
          icon="💧"
        />
        <MetricCard
          label="持有者"
          value={
            goplusLoading
              ? '…'
              : goplus?.holders
                ? goplus.holders.toLocaleString()
                : '-'
          }
          icon="👥"
        />
        <MetricCard
          label="24h量"
          value={fmtCompact(token.volume24h)}
          icon="📊"
          sub={`买${token.txBuys24h} / 卖${token.txSells24h}`}
        />
        <MetricCard
          label="安全"
          value={securityLabel}
          icon="🛡️"
          color={securityColor}
        />
      </div>

      {/* DexScreener embed chart */}
      <div className="relative flex-1 px-2 pb-2" style={{ minHeight: '400px' }}>
        {!iframeLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <iframe
          src={`https://dexscreener.com/${dexChain}/${embedAddr}?embed=1&theme=dark&trades=0&info=0`}
          className="h-full w-full rounded-lg border-0"
          style={{ opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          onLoad={() => setIframeLoaded(true)}
          title="DexScreener Chart"
          allow="clipboard-write"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Bottom bar (fixed) */}
      <div className="safe-bottom flex items-center gap-3 border-t border-border/30 bg-background px-4 py-3">
        <button
          type="button"
          onClick={copyContract}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface/40 py-3 text-sm font-semibold text-white transition-all hover:bg-surface/70 active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          📋 复制合约
        </button>
        <button
          type="button"
          onClick={goToChat}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-black transition-all hover:bg-primary-hover active:scale-[0.97]"
        >
          💬 去交易
        </button>
      </div>
    </div>
  );
}
