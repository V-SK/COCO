import { useAuthStore } from '@/stores/authStore';
import { authWallet, getTwitterAuthUrl, getNonce } from '@/services/authApi';
import { openWalletModal } from '@/services/walletModal';
import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { signMessage } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import welcomeImg from '/coco-welcome.jpg?url';

export function LoginPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
    const setAuth = useAuthStore((s) => s.setAuth);

  const [walletChecking, setWalletChecking] = useState(false);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletResult, setWalletResult] = useState<{ balance: number; qualified: boolean } | null>(null);

  // Auto-verify when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      handleVerifyWallet(address);
    }
  }, [isConnected, address]);

  async function handleConnectWallet() {
    try {
      setError(null);
      const opened = await openWalletModal('Connect');
      if (!opened) {
        setError('钱包连接不可用，请安装 MetaMask 或使用 WalletConnect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    }
  }

  async function handleVerifyWallet(walletAddress: string) {
    try {
      setWalletChecking(true);
      setError(null);

      // Get nonce and sign it
      const { message } = await getNonce(walletAddress);
      const signature = await signMessage(wagmiConfig, { message });

      const data = await authWallet(walletAddress, signature);
      setWalletResult({ balance: data.balance, qualified: data.qualified });

      if (data.qualified) {
        setAuth({
          token: data.token,
          qualified: true,
          method: data.method,
          balance: data.balance,
          user: data.user,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setWalletChecking(false);
    }
  }

  async function handleTwitterLogin() {
    try {
      setTwitterLoading(true);
      setError(null);
      // Pass wallet address if connected, empty string if not
      const url = await getTwitterAuthUrl(address || '');
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
      setError(err instanceof Error ? err.message : 'Twitter 验证失败');
    } finally {
      setTwitterLoading(false);
    }
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

        {/* Two independent options */}
        <div className="mt-10 w-full space-y-3">
          <p className="text-center text-xs text-neutral-500 mb-2">
            满足以下任一条件即可使用
          </p>

          {/* Option 1: Connect Wallet (check COCO balance) */}
          <button
            type="button"
            onClick={handleConnectWallet}
            disabled={walletChecking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
          >
            {walletChecking ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                验证中...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
                连接钱包（持有 ≥100 COCO）
              </>
            )}
          </button>

          {/* Wallet result feedback */}
          {walletResult && !walletResult.qualified && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-center">
              <p className="text-xs text-yellow-500">
                当前持有 {walletResult.balance.toFixed(0)} COCO，不足 100
              </p>
              <a
                href="https://pancakeswap.finance/swap?outputCurrency=0x80f1ff15b887cb19295d88c8c16f89d47f6d8888&chain=bsc"
                target="_blank"
                rel="noopener"
                className="text-xs text-primary hover:underline"
              >
                去 PancakeSwap 购买 →
              </a>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs text-neutral-600">或</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          {/* Option 2: Twitter (follow @COCO_DOGE) */}
          <button
            type="button"
            onClick={handleTwitterLogin}
            disabled={twitterLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/50 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-neutral-700/50 active:scale-[0.98] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {twitterLoading ? '跳转中...' : 'Twitter 验证（关注 @COCO_DOGE）'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Disconnect if connected but not qualified */}
        {isConnected && (
          <button
            type="button"
            onClick={() => { disconnect(); setWalletResult(null); }}
            className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
          >
            断开钱包
          </button>
        )}
      </div>
    </div>
  );
}
