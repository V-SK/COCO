import type { MemeToken } from '@/hooks/useDexTrending';
import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Helpers ── */

function formatAge(timestamp: number): string {
  if (!timestamp) return '?';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  if (price >= 0.000001) return `$${price.toFixed(6)}`;
  /* For extremely small prices, use subscript notation */
  const str = price.toFixed(18);
  const match = str.match(/^0\.(0+)([1-9]\d{0,3})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2];
    return `$0.0{${zeros}}${sig}`;
  }
  return `$${price.toExponential(2)}`;
}

function formatCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* ── Token Avatar ── */
function TokenAvatar({ token }: { token: MemeToken }) {
  const [failed, setFailed] = useState(false);

  if (!token.imageUrl || failed) {
    /* Generate a consistent color from token name */
    let hash = 0;
    for (let i = 0; i < token.symbol.length; i++) {
      hash = token.symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;

    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
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
      className="h-9 w-9 shrink-0 rounded-full object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

/* ── Skeleton Row ── */
function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="flex w-full items-center gap-3 rounded-xl border border-border/20 bg-surface/20 px-3.5 py-3
        animate-fade-in-up [animation-fill-mode:backwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Avatar skeleton */}
      <div className="h-9 w-9 shrink-0 rounded-full bg-surface/60 shimmer-bg" />
      {/* Text skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-20 rounded bg-surface/60 shimmer-bg" />
        <div className="h-3 w-14 rounded bg-surface/40 shimmer-bg" />
      </div>
      {/* Right skeleton */}
      <div className="space-y-2 text-right">
        <div className="ml-auto h-3.5 w-16 rounded bg-surface/60 shimmer-bg" />
        <div className="ml-auto h-3 w-12 rounded bg-surface/40 shimmer-bg" />
      </div>
    </div>
  );
}

/* ── Price Change Badge ── */
function PriceChangeBadge({ value }: { value: number }) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlash(true);
      prevRef.current = value;
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  const up = value >= 0;

  return (
    <span
      className={`
        inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold
        transition-colors duration-200
        ${up ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}
        ${flash ? (up ? 'price-flash-green' : 'price-flash-red') : ''}
      `}
    >
      {up ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

/* ── Token Row ── */
function MemeTokenRow({
  token,
  index,
  onClick,
}: {
  token: MemeToken;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        animate-fade-in-up flex w-full items-center gap-3 rounded-xl
        border border-border/20 bg-surface/20 px-3.5 py-2.5
        text-left transition-all duration-150
        hover:bg-surface/50 active:scale-[0.98]
        [animation-fill-mode:backwards]
      "
      style={{ animationDelay: `${60 + index * 35}ms` }}
    >
      {/* Avatar */}
      <TokenAvatar token={token} />

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">
            {token.symbol}
          </span>
          <span className="shrink-0 rounded bg-surface/60 px-1 py-0.5 text-[9px] text-neutral-500">
            {formatAge(token.pairCreatedAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="truncate">{token.name}</span>
          {token.liquidity > 0 && (
            <span className="shrink-0">💧{formatCompact(token.liquidity)}</span>
          )}
        </div>
      </div>

      {/* Price + Change */}
      <div className="shrink-0 text-right">
        <p className="font-mono text-[13px] font-semibold text-white">
          {formatPrice(token.priceUsd)}
        </p>
        <div className="mt-0.5 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-neutral-500">
            {formatCompact(token.marketCap)}
          </span>
          <PriceChangeBadge value={token.priceChange24h} />
        </div>
      </div>
    </button>
  );
}

/* ── Pull-to-Refresh ── */
function PullToRefresh({
  onRefresh,
  refreshing,
  children,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pullDist, setPullDist] = useState(0);
  const [released, setReleased] = useState(false);
  const threshold = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    setReleased(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    /* Resistance curve */
    setPullDist(Math.min(dy * 0.4, 80));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDist >= threshold) {
      setReleased(true);
      onRefresh();
    }
    setPullDist(0);
  }, [pullDist, onRefresh, threshold]);

  /* Reset after refresh completes */
  useEffect(() => {
    if (!refreshing && released) {
      const t = setTimeout(() => setReleased(false), 300);
      return () => clearTimeout(t);
    }
  }, [refreshing, released]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: refreshing ? 36 : pullDist > 0 ? pullDist : 0,
          opacity: refreshing || pullDist > 10 ? 1 : 0,
        }}
      >
        <div
          className={`h-4 w-4 rounded-full border-2 border-primary border-t-transparent ${
            refreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: !refreshing ? `rotate(${pullDist * 4}deg)` : undefined,
          }}
        />
        <span className="ml-2 text-[11px] text-neutral-500">
          {refreshing ? '刷新中...' : pullDist >= threshold ? '松开刷新' : '下拉刷新'}
        </span>
      </div>

      {children}
    </div>
  );
}

/* ── Main List Component ── */
export function MemeTokenList({
  tokens,
  loading,
  refreshing,
  onRefresh,
  onTokenClick,
}: {
  tokens: MemeToken[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onTokenClick: (token: MemeToken) => void;
}) {
  const [fadeKey, setFadeKey] = useState(0);
  const prevTokensRef = useRef<string>('');

  /* Trigger crossfade when token list identity changes */
  useEffect(() => {
    const identity = tokens
      .slice(0, 5)
      .map((t) => t.address)
      .join(',');
    if (prevTokensRef.current && prevTokensRef.current !== identity) {
      setFadeKey((k) => k + 1);
    }
    prevTokensRef.current = identity;
  }, [tokens]);

  /* Loading skeleton */
  if (loading && tokens.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} delay={i * 60} />
        ))}
      </div>
    );
  }

  /* Empty state */
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
        <span className="text-3xl">🔍</span>
        <p className="mt-2 text-sm">暂无数据</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-3 rounded-lg bg-surface/50 px-4 py-1.5 text-xs text-primary transition-colors hover:bg-surface/80"
        >
          刷新试试
        </button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={onRefresh} refreshing={refreshing}>
      <div
        key={fadeKey}
        className="space-y-1.5 animate-fade-in"
      >
        {/* Column header */}
        <div className="flex items-center justify-between px-3.5 py-1 text-[10px] text-neutral-600">
          <span>代币</span>
          <div className="flex items-center gap-4">
            <span>市值</span>
            <span className="w-14 text-right">24h</span>
          </div>
        </div>

        {tokens.map((token, i) => (
          <MemeTokenRow
            key={`${token.chainId}:${token.address}`}
            token={token}
            index={i}
            onClick={() => onTokenClick(token)}
          />
        ))}

        {/* Bottom count */}
        <p className="py-2 text-center text-[10px] text-neutral-600">
          共 {tokens.length} 个代币 · DexScreener
        </p>
      </div>
    </PullToRefresh>
  );
}
