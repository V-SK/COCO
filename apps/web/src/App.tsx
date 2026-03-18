import { LoginPage } from '@/components/auth/LoginPage';
import { TwitterCallback } from '@/components/auth/TwitterCallback';
import { useAuthStore } from '@/stores/authStore';
import { checkAuth } from '@/services/authApi';
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
  const authToken = useAuthStore((s) => s.token);
  const authQualified = useAuthStore((s) => s.qualified);
  const authLoading = useAuthStore((s) => s.loading);
  const setAuth = useAuthStore((s) => s.setAuth);
  
  const setAuthLoading = useAuthStore((s) => s.setLoading);

  // Check if this is a Twitter callback route
  const isTwitterCallback = window.location.pathname === '/auth/twitter/callback';

  // Verify persisted auth on mount
  useEffect(() => {
    if (!authToken) {
      setAuthLoading(false);
      return;
    }
    checkAuth(authToken)
      .then((data) => {
        setAuth({
          token: authToken,
          qualified: data.qualified,
          method: data.method,
          balance: data.balance,
          user: data.user,
        });
      })
      .catch(() => {
        // Don't logout on network errors — trust the persisted token
        // Only logout if we know the token is invalid (handled by 401 in checkAuth)
        setAuthLoading(false);
      });
  }, []);

  // Listen for Twitter auth popup message
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'coco_twitter_auth' && e.data.data) {
        // Re-check auth status
        if (authToken) {
          checkAuth(authToken).then((data) => {
            setAuth({
              token: authToken,
              qualified: data.qualified,
              method: data.method,
              balance: data.balance,
              user: data.user,
            });
          }).catch(() => {});
        }
        // Also directly update if data says qualified
        if (e.data.data.qualified && e.data.data.token) {
          const d = e.data.data;
          setAuth({
            token: d.token,
            qualified: true,
            method: d.method,
            user: { wallet: '', twitter: d.twitter?.username, avatar: d.twitter?.avatar },
          });
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [authToken, setAuth]);

  // Twitter callback page
  if (isTwitterCallback) {
    return <TwitterCallback />;
  }

  // Auth gate
  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authQualified) {
    return <LoginPage />;
  }


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
