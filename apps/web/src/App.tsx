import { ChatWindow } from '@/components/chat/ChatWindow';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
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
    <div className="flex h-dvh bg-background text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <ChatWindow backendReady={!error && !!health} error={error} />
      </div>
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
