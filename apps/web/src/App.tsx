import { ChatWindow } from '@/components/chat/ChatWindow';
import { Badge } from '@/components/common/Badge';
import { Header } from '@/components/common/Header';
import { Skeleton } from '@/components/common/Skeleton';
import { StatusDot } from '@/components/common/StatusDot';
import { Toast } from '@/components/common/Toast';
import { SwapConfirmModal } from '@/components/modals/SwapConfirmModal';
import { wagmiConfig } from '@/config/wagmi';
import { getHealth } from '@/services/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';

const queryClient = new QueryClient();

interface HealthState {
  ok: boolean;
  chainId: number;
  walletMode: string;
  plugins: string[];
}

function AppContent() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then((data) => {
        setHealth(data);
      })
      .catch((caughtError: unknown) => {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : 'Unknown backend error';
        setError(message);
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-white">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
          {error ? (
            <section className="animate-fade-in rounded-2xl border border-error bg-error/10 px-4 py-4 text-sm sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-error">后端连接失败</p>
                  <p className="text-slate-300">{error}</p>
                </div>
                <code className="rounded-xl bg-background px-3 py-2 text-xs text-slate-200">
                  pnpm --filter @coco/cli build &amp;&amp; node
                  apps/cli/dist/index.js serve
                </code>
              </div>
            </section>
          ) : health ? (
            <section className="animate-fade-in flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/80 px-4 py-4 text-sm backdrop-blur sm:px-5">
              <StatusDot
                status={health.ok ? 'success' : 'warning'}
                label={health.ok ? 'Backend Ready' : 'Unknown'}
              />
              <Badge variant="default">Chain {health.chainId}</Badge>
              <Badge variant="default">Wallet {health.walletMode}</Badge>
              <Badge variant="default">Plugins {health.plugins.length}</Badge>
            </section>
          ) : (
            <section className="grid gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-sm sm:px-5">
              <div className="flex items-center gap-3">
                <StatusDot status="idle" label="正在连接后端..." />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </section>
          )}
          <ChatWindow backendReady={!error && !!health} />
        </div>
      </main>
      <Toast />
      <SwapConfirmModal />
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
