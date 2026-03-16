import { walletModalEnabled } from '@/config/wagmi';
import { openWalletModal } from '@/services/walletModal';
import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
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
}: {
  children: React.ReactNode;
}) {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const clearMessages = useChatStore((state) => state.clearMessages);

  return (
    <header className="flex items-center justify-between bg-background/80 px-3 py-2.5 backdrop-blur-md sm:px-4">
      <div className="flex items-center gap-1">
        {/* Hamburger menu */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
          aria-label="打开侧边栏"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {/* New chat button */}
        <button
          type="button"
          onClick={clearMessages}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
          aria-label="新对话"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
      <span className="text-sm font-medium text-neutral-200">Coco</span>
      {children}
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
    <HeaderShell>
      {isConnected && address ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={walletModalLoading}
            onClick={() => {
              void handleOpenWallet('Account');
            }}
            className="rounded-full bg-surface px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-surface-hover hover:text-white disabled:opacity-60"
          >
            {walletModalLoading ? '...' : formatAddress(address)}
          </button>
          <button
            type="button"
            onClick={() => {
              disconnect();
            }}
            className="rounded-full px-2.5 py-1.5 text-xs text-neutral-500 transition hover:text-white"
          >
            断开
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={walletModalLoading}
          onClick={() => {
            void handleOpenWallet();
          }}
          className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black transition hover:bg-neutral-200 active:scale-95 disabled:opacity-60"
        >
          {walletModalLoading ? '...' : '连接钱包'}
        </button>
      )}
    </HeaderShell>
  );
}

function HeaderWithFallback() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <HeaderShell>
      {isConnected && address ? (
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-surface px-3 py-1.5 text-xs text-neutral-400">
            {formatAddress(address)}
          </span>
          <button
            type="button"
            onClick={() => {
              disconnect();
            }}
            className="rounded-full px-2.5 py-1.5 text-xs text-neutral-500 transition hover:text-white"
          >
            断开
          </button>
        </div>
      ) : (
        <Tooltip content="请先配置 VITE_WC_PROJECT_ID 以启用钱包">
          <button
            type="button"
            disabled
            className="rounded-full bg-neutral-800 px-4 py-1.5 text-xs font-medium text-neutral-500"
          >
            连接钱包
          </button>
        </Tooltip>
      )}
    </HeaderShell>
  );
}
