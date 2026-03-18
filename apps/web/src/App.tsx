import { ChatWindow } from '@/components/chat/ChatWindow';
import { BottomNav } from '@/components/common/BottomNav';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { SplashScreen } from '@/components/common/SplashScreen';
import { SwipeEdge } from '@/components/common/SwipeEdge';
import { Ticker } from '@/components/common/Ticker';
import { Toast } from '@/components/common/Toast';
import { MarketPage } from '@/components/market/MarketPage';
import { SwapConfirmModal } from '@/components/modals/SwapConfirmModal';
import { TradingPage } from '@/components/trading/TradingPage';
import { wagmiConfig } from '@/config/wagmi';
import { useBinanceTickers } from '@/hooks/useBinanceTickers';
import { getHealth } from '@/services/api';
import { useUiStore } from '@/stores/uiStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
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
  const [showSplash, setShowSplash] = useState(true);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const activeTab = useUiStore((s) => s.activeTab);
  const { tickers } = useBinanceTickers();
  // ── Auth ────────────────────────────────────────────────────




  // Auth gate disabled — direct access


  const hideSplash = useCallback(() => setShowSplash(false), []);

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

  function renderPage() {
    switch (activeTab) {
      case 'market':
        return <MarketPage tickers={tickers} />;
      case 'trading':
        return <TradingPage />;
      default:
        return <ChatWindow backendReady={!error && !!health} error={error} />;
    }
  }

  return (
    <>
      {showSplash ? <SplashScreen onFinish={hideSplash} /> : null}
      <div className="native-status-pad flex h-dvh flex-col bg-background text-white">
        <Sidebar />
        <SwipeEdge onSwipeRight={() => setSidebarOpen(true)} />
        <Header />
        <Ticker tickers={tickers} />
        {renderPage()}
        {activeTab === 'chat' ? <Toast /> : null}
        <BottomNav />
        <SwapConfirmModal />
      </div>
    </>
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
