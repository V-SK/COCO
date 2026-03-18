import { useAuthStore } from '@/stores/authStore';
import { authWallet, getTwitterAuthUrl } from '@/services/authApi';
import { openWalletModal } from '@/services/walletModal';
import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import welcomeImg from '/coco-welcome.jpg?url';

export function LoginPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<'connect' | 'checking' | 'unqualified'>('connect');
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [twitterLoading, setTwitterLoading] = useState(false);

  // When wallet connects via modal, auto-check
  useEffect(() => {
    if (isConnected && address && step === 'connect') {
      handleVerify(address);
    }
  }, [isConnected, address]);

  async function handleConnect() {
    try {
      setError(null);
      const opened = await openWalletModal('Connect');
      if (!opened) {
        setError('钱包连接不可用，请安装 MetaMask 或使用 WalletConnect');
      }
      // The actual verification happens in the useEffect above when address changes
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    }
  }

  async function handleVerify(walletAddress: string) {
    try {
      setStep('checking');
      setError(null);

      const data = await authWallet(walletAddress);
      setBalance(data.balance);

      if (data.qualified) {
        setAuth({
          token: data.token,
          qualified: true,
          method: data.method,
          balance: data.balance,
          user: data.user,
        });
        return;
      }

      // Not qualified — show options
      setAuth({
        token: data.token,
        qualified: false,
        method: null,
        balance: data.balance,
        user: data.user,
      });
      setStep('unqualified');
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
      setStep('connect');
    }
  }

  async function handleTwitterLogin() {
    if (!address) return;
    try {
      setTwitterLoading(true);
      setError(null);
      const url = await getTwitterAuthUrl(address);
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      window.open(
        url,
        'twitter_auth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Twitter 登录失败');
    } finally {
      setTwitterLoading(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setStep('connect');
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(ellipse, rgba(240,185,11,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Logo */}
        <img
          src={welcomeImg}
          alt="Coco AI"
          className="h-40 w-auto object-contain"
          style={{
            maskImage: 'radial-gradient(ellipse 70% 75% at 50% 42%, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 75% at 50% 42%, black 40%, transparent 80%)',
          }}
        />
        <h1 className="mt-4 text-3xl font-bold text-primary">COCO</h1>
        <p className="mt-1 text-sm text-neutral-400">Web3 AI 智能体</p>

        {/* Step: Connect Wallet */}
        {step === 'connect' && (
          <div className="mt-10 w-full space-y-4">
            <button
              type="button"
              onClick={handleConnect}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              </svg>
              连接钱包
            </button>

            <p className="text-center text-xs text-neutral-500">
              需要持有 ≥100 COCO 或 关注{' '}
              <a href="https://x.com/COCO_DOGE" target="_blank" rel="noopener" className="text-primary hover:underline">
                @COCO_DOGE
              </a>
            </p>
          </div>
        )}

        {/* Step: Checking */}
        {step === 'checking' && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-neutral-400">验证中...</p>
          </div>
        )}

        {/* Step: Not Qualified */}
        {step === 'unqualified' && (
          <div className="mt-8 w-full space-y-4">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
              <p className="text-sm text-yellow-500">
                当前持有 {balance.toFixed(0)} COCO（需要 ≥100）
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                持有代币 或 关注推特，满足一个即可
              </p>
            </div>

            {/* Option 1: Buy COCO */}
            <a
              href="https://pancakeswap.finance/swap?outputCurrency=0x80f1ff15b887cb19295d88c8c16f89d47f6d8888&chain=bsc"
              target="_blank"
              rel="noopener"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-6 py-3 text-sm font-medium text-primary transition-all hover:bg-primary/10 active:scale-[0.98]"
            >
              💰 去 PancakeSwap 购买 COCO
            </a>

            {/* Option 2: Follow on Twitter */}
            <button
              type="button"
              onClick={handleTwitterLogin}
              disabled={twitterLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/50 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-neutral-700/50 active:scale-[0.98] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              {twitterLoading ? '跳转中...' : '用 Twitter 验证关注'}
            </button>

            {/* Re-check balance */}
            <button
              type="button"
              onClick={() => address && handleVerify(address)}
              className="w-full text-center text-xs text-primary/60 hover:text-primary"
            >
              🔄 重新检查余额
            </button>

            {/* Disconnect */}
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300"
            >
              断开钱包连接
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-center text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
