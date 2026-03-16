import { walletModalEnabled } from '@/config/wagmi';
import { openWalletModal } from '@/services/walletModal';
import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { Badge } from './Badge';
import { StatusDot } from './StatusDot';
import { Tooltip } from './Tooltip';

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
  if (!walletModalEnabled) {
    return <HeaderWithFallback />;
  }

  return <HeaderWithAppKit />;
}

function HeaderShell({
  children,
  isConnected,
}: {
  children: React.ReactNode;
  isConnected: boolean;
}) {
  return (
    <header className="border-b border-border bg-background-secondary/90 px-4 py-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-black">
            C
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
                Coco
              </h1>
              <StatusDot status={isConnected ? 'success' : 'warning'} />
            </div>
            <p className="hidden text-xs uppercase tracking-[0.25em] text-slate-400 sm:block">
              AI Trading Agent
            </p>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

function HeaderWithAppKit() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [walletModalLoading, setWalletModalLoading] = useState(false);

  async function handleOpenWallet(view?: 'Account') {
    setWalletModalLoading(true);
    try {
      await openWalletModal(view);
    } finally {
      setWalletModalLoading(false);
    }
  }

  return (
    <HeaderShell isConnected={isConnected}>
      {isConnected && address ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            disabled={walletModalLoading}
            onClick={() => {
              void handleOpenWallet('Account');
            }}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-slate-300 transition hover:border-border-light hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
          >
            <span className="sm:hidden">钱包</span>
            <span className="hidden sm:inline">
              {walletModalLoading ? '加载中...' : formatAddress(address)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              disconnect();
            }}
            className="rounded-xl border border-border px-4 py-2 text-sm text-slate-300 transition hover:border-border-light hover:text-white"
          >
            断开
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={walletModalLoading}
            onClick={() => {
              void handleOpenWallet();
            }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black transition hover:bg-primary-hover active:animate-bounce-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            {walletModalLoading ? '加载钱包...' : '连接钱包'}
          </button>
        </div>
      )}
    </HeaderShell>
  );
}

function HeaderWithFallback() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <HeaderShell isConnected={isConnected}>
      {isConnected && address ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-slate-300 sm:px-4">
            <span className="sm:hidden">钱包</span>
            <span className="hidden sm:inline">{formatAddress(address)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              disconnect();
            }}
            className="rounded-xl border border-border px-4 py-2 text-sm text-slate-300 transition hover:border-border-light hover:text-white"
          >
            断开
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Tooltip content="请先配置 VITE_WC_PROJECT_ID 以启用多钱包弹窗">
            <span>
              <button
                type="button"
                disabled
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-black"
              >
                连接钱包
              </button>
            </span>
          </Tooltip>
          <Badge variant="warning">缺少 Project ID</Badge>
        </div>
      )}
    </HeaderShell>
  );
}
