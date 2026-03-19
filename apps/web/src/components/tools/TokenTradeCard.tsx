import { Badge } from '@/components/common/Badge';
import { useUiStore } from '@/stores/uiStore';
import type { ScanResultLike } from '@/types/toolResults';
import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';

/* ── Types ── */

interface TokenTradeData extends ScanResultLike {
  tokenName?: string | undefined;
  tokenSymbol?: string | undefined;
  price?: number | null | undefined;
  liquidity?: number | null | undefined;
  volume24h?: number | null | undefined;
  holderCount?: string | null | undefined;
  marketCap?: number | null | undefined;
  priceChange24h?: number | null | undefined;
  buyTax?: string | undefined;
  sellTax?: string | undefined;
  isOpenSource?: boolean | undefined;
  isRenounced?: boolean | undefined;
  isHoneypot?: boolean | undefined;
  poolLocked?: string | undefined;
  recommendation?: string | undefined;
}

interface TokenTradeCardProps {
  result: TokenTradeData;
  onBuy?: (address: string, amountBnb: string) => void;
  onSell?: (address: string, percent: number) => void;
}

/* ── Helpers ── */

const BUY_AMOUNTS = ['0.1', '0.3', '0.5', '1.0'];
const SELL_PERCENTS = [25, 50, 75, 100];

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(10)}`;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/* ── Component ── */

export function TokenTradeCard({ result, onBuy, onSell }: TokenTradeCardProps) {
  const { address: walletAddress, isConnected } = useAccount();
  const { data: bnbBalance } = useBalance({ address: walletAddress });
  const showToast = useUiStore((state) => state.showToast);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [slippageBps, setSlippageBps] = useState(300);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  const scoreColor =
    result.trustScore >= 80
      ? 'text-success'
      : result.trustScore >= 50
        ? 'text-warning'
        : 'text-error';

  const scoreBg =
    result.trustScore >= 80
      ? 'bg-success'
      : result.trustScore >= 50
        ? 'bg-warning'
        : 'bg-error';

  const balanceStr = bnbBalance
    ? `${(Number(bnbBalance.value) / 10 ** bnbBalance.decimals).toFixed(4)} BNB`
    : '-- BNB';

  function handleBuy(amount: string) {
    if (!isConnected) {
      showToast('请先连接钱包', 'error');
      return;
    }
    onBuy?.(result.address, amount);
  }

  function handleSell(percent: number) {
    if (!isConnected) {
      showToast('请先连接钱包', 'error');
      return;
    }
    onSell?.(result.address, percent);
  }

  return (
    <div className="w-full space-y-0 overflow-hidden rounded-2xl border border-border/40 bg-surface/80">
      {/* ── Header: Token Info ── */}
      <div className="border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {(result.tokenSymbol ?? '?')[0]}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {result.tokenName ?? 'Unknown'}{' '}
                <span className="text-neutral-400">({result.tokenSymbol ?? '???'})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(result.address);
                  showToast('合约地址已复制', 'success');
                }}
                className="text-xs text-neutral-500 transition hover:text-neutral-300"
              >
                {formatAddress(result.address)} 📋
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{fmtPrice(result.price)}</p>
            {result.priceChange24h != null && (
              <p
                className={`text-xs font-medium ${
                  result.priceChange24h >= 0 ? 'text-success' : 'text-error'
                }`}
              >
                {result.priceChange24h >= 0 ? '+' : ''}
                {result.priceChange24h.toFixed(2)}% 24h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-px border-b border-border/30 bg-border/20">
        <div className="bg-surface/80 px-3 py-2 text-center">
          <p className="text-[10px] text-neutral-500">市值</p>
          <p className="text-xs font-medium text-white">{fmtUsd(result.marketCap)}</p>
        </div>
        <div className="bg-surface/80 px-3 py-2 text-center">
          <p className="text-[10px] text-neutral-500">池子</p>
          <p className="text-xs font-medium text-white">{fmtUsd(result.liquidity)}</p>
        </div>
        <div className="bg-surface/80 px-3 py-2 text-center">
          <p className="text-[10px] text-neutral-500">24h量</p>
          <p className="text-xs font-medium text-white">{fmtUsd(result.volume24h)}</p>
        </div>
      </div>

      {/* ── Security Row ── */}
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-2">
        <div className="flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${scoreBg}`} />
          <span className={`text-xs font-medium ${scoreColor}`}>
            {result.trustScore}/100
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.isOpenSource != null && (
            <span className={`text-[10px] ${result.isOpenSource ? 'text-success' : 'text-error'}`}>
              {result.isOpenSource ? '✅开源' : '❌未开源'}
            </span>
          )}
          {result.isRenounced != null && (
            <span className={`text-[10px] ${result.isRenounced ? 'text-success' : 'text-error'}`}>
              {result.isRenounced ? '✅弃权' : '⚠️未弃权'}
            </span>
          )}
          {result.isHoneypot != null && (
            <span className={`text-[10px] ${result.isHoneypot ? 'text-error' : 'text-success'}`}>
              {result.isHoneypot ? '🚨蜜罐' : '✅非蜜罐'}
            </span>
          )}
          {result.buyTax != null && result.sellTax != null && (
            <span className="text-[10px] text-neutral-400">
              税 {result.buyTax}/{result.sellTax}
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          <a
            href={`https://bscscan.com/token/${result.address}`}
            target="_blank"
            rel="noreferrer"
            className="rounded px-1.5 py-0.5 text-[10px] text-primary transition hover:bg-primary/10"
          >
            BSC
          </a>
          <a
            href={`https://dexscreener.com/bsc/${result.address}`}
            target="_blank"
            rel="noreferrer"
            className="rounded px-1.5 py-0.5 text-[10px] text-primary transition hover:bg-primary/10"
          >
            DEX
          </a>
        </div>
      </div>

      {/* ── Wallet Balance ── */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
        <span className="text-xs text-neutral-400">💰 余额</span>
        <span className="text-xs font-medium text-white">{balanceStr}</span>
      </div>

      {/* ── Buy / Sell Toggle ── */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 rounded-lg bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('buy')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              activeTab === 'buy'
                ? 'bg-success/20 text-success'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🟢 买入
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sell')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              activeTab === 'sell'
                ? 'bg-error/20 text-error'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🔴 卖出
          </button>
        </div>
      </div>

      {/* ── Quick Buttons ── */}
      <div className="px-4 py-3">
        {activeTab === 'buy' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {BUY_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleBuy(amt)}
                  disabled={!isConnected || result.isHoneypot === true}
                  className="rounded-lg border border-success/30 bg-success/5 py-2 text-xs font-medium text-success transition hover:bg-success/15 active:scale-95 disabled:opacity-30"
                >
                  {amt} BNB
                </button>
              ))}
            </div>
            {showCustom ? (
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="自定义 BNB"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="flex-1 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-xs text-white outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customAmount && Number(customAmount) > 0) {
                      handleBuy(customAmount);
                    }
                  }}
                  disabled={!isConnected || !customAmount}
                  className="rounded-lg bg-success/20 px-4 py-2 text-xs font-medium text-success transition hover:bg-success/30 disabled:opacity-30"
                >
                  买入
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="w-full rounded-lg border border-border/30 py-2 text-xs text-neutral-400 transition hover:border-border/60 hover:text-white"
              >
                自定义金额
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {SELL_PERCENTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleSell(pct)}
                  disabled={!isConnected}
                  className="rounded-lg border border-error/30 bg-error/5 py-2 text-xs font-medium text-error transition hover:bg-error/15 active:scale-95 disabled:opacity-30"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Settings Row ── */}
      <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-500">滑点</span>
            <select
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-white outline-none"
            >
              <option value={100}>1%</option>
              <option value={300}>3%</option>
              <option value={500}>5%</option>
              <option value={1000}>10%</option>
              <option value={2000}>20%</option>
              <option value={5000}>50%</option>
            </select>
          </div>
        </div>
        {result.isHoneypot === true && (
          <Badge variant="error">🚨 蜜罐 — 无法卖出</Badge>
        )}
      </div>

      {/* ── Risk warnings ── */}
      {result.risks.length > 0 && (
        <div className="border-t border-border/30 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {result.risks.slice(0, 3).map((risk) => (
              <span
                key={risk}
                className="rounded bg-error/10 px-2 py-0.5 text-[10px] text-error/80"
              >
                {risk}
              </span>
            ))}
            {result.risks.length > 3 && (
              <span className="text-[10px] text-neutral-500">
                +{result.risks.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Type guard ── */

export function isTokenTradeData(value: unknown): value is TokenTradeData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.address === 'string' &&
    typeof v.trustScore === 'number' &&
    Array.isArray(v.risks) &&
    // Distinguish from plain ScanResultLike by presence of trade-relevant fields
    (v.tokenName !== undefined || v.tokenSymbol !== undefined || v.price !== undefined)
  );
}
