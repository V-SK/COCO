import { walletModalEnabled } from '@/config/wagmi';
import { openWalletModal } from '@/services/walletModal';
import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { haptic } from '@/utils/haptics';
import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import avatarImg from '/coco-avatar.jpg?url';

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const messages = useChatStore((state) => state.messages);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [walletLoading, setWalletLoading] = useState(false);

  function handleNewChat() {
    haptic();
    clearMessages();
    setSidebarOpen(false);
  }

  async function handleWallet(view?: 'Account') {
    if (!walletModalEnabled) return;
    haptic();
    setWalletLoading(true);
    try {
      await openWalletModal(view);
    } finally {
      setWalletLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop overlay */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false);
          }}
          role="button"
          tabIndex={-1}
          aria-label="关闭侧边栏"
        />
      ) : null}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-background-secondary transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top section */}
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2.5">
            <img src={avatarImg} alt="Coco" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/20" />
            <span className="text-sm font-semibold text-white">Coco AI</span>
          </div>
          <button
            type="button"
            onClick={() => { haptic(); setSidebarOpen(false); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
            aria-label="关闭侧边栏"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-surface hover:text-white"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            新对话
          </button>
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {messages.length > 0 ? (
            <div className="space-y-0.5">
              <p className="px-2 pb-2 text-xs font-medium text-neutral-500">
                当前对话
              </p>
              <div className="rounded-lg bg-surface/50 px-3 py-2.5 text-sm text-white">
                {messages
                  .find((m) => m.role === 'user')
                  ?.content.slice(0, 40) ?? '对话进行中...'}
                {(messages.find((m) => m.role === 'user')?.content.length ??
                  0) > 40
                  ? '...'
                  : ''}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-neutral-500">暂无对话记录</p>
              <p className="mt-1 text-xs text-neutral-600">开始新对话吧</p>
            </div>
          )}
        </div>

        {/* Bottom section — wallet + version */}
        <div className="border-t border-border px-3 py-3 space-y-2">
          {/* Wallet */}
          {isConnected && address ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={walletLoading}
                onClick={() => { void handleWallet('Account'); }}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-neutral-300 transition hover:bg-surface"
              >
                <div className="h-2 w-2 rounded-full bg-success" />
                {walletLoading ? '...' : formatAddress(address)}
              </button>
              <button
                type="button"
                onClick={() => { haptic(); disconnect(); }}
                className="rounded-full px-2.5 py-1.5 text-xs text-neutral-500 transition hover:text-white"
              >
                断开
              </button>
            </div>
          ) : walletModalEnabled ? (
            <button
              type="button"
              disabled={walletLoading}
              onClick={() => { void handleWallet(); }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-surface hover:text-white"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M16 12h.01" />
              </svg>
              {walletLoading ? '连接中...' : '连接钱包'}
            </button>
          ) : null}

          {/* Settings placeholder */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-neutral-500 transition hover:bg-surface hover:text-neutral-300"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            设置
          </button>

          {/* Version */}
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-neutral-600">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            Coco AI v1.2
          </div>
        </div>
      </aside>
    </>
  );
}
