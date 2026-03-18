import { twitterCallback } from '@/services/authApi';
import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState } from 'react';

export function TwitterCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('验证中...');
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!code || !state) {
          setStatus('error');
          setMessage('缺少授权参数');
          return;
        }

        const data = await twitterCallback(code, state);

        if (data.qualified) {
          // Save auth to localStorage (shared across tabs)
          setAuth({
            token: data.token,
            qualified: true,
            method: data.method,
            user: {
              wallet: '',
              twitter: data.twitter.username,
              avatar: data.twitter.avatar,
            },
          });

          setStatus('success');
          setMessage(`欢迎 @${data.twitter.username}`);

          // Try to notify opener (works in desktop popup)
          try {
            if (window.opener) {
              window.opener.postMessage({ type: 'coco_twitter_auth', data }, '*');
            }
          } catch { /* ignore */ }

          // Redirect to main app after short delay
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          setStatus('error');
          setMessage(
            data.isFollowing
              ? '验证失败，请稍后重试'
              : '请先关注 @COCO_DOGE 后重试'
          );
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : '验证失败');
      }
    }

    handleCallback();
  }, [setAuth]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="text-center">
        {status === 'loading' && (
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        {status === 'success' && (
          <div className="text-4xl">✅</div>
        )}
        {status === 'error' && (
          <div className="text-4xl">❌</div>
        )}
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-400' : 'text-neutral-300'}`}>
          {message}
        </p>
        {status === 'success' && (
          <p className="mt-2 text-xs text-neutral-500">正在跳转...</p>
        )}
        {status === 'error' && (
          <div className="mt-4 space-y-2">
            <a
              href="https://x.com/COCO_DOGE"
              target="_blank"
              rel="noopener"
              className="block text-sm text-primary hover:underline"
            >
              去关注 @COCO_DOGE →
            </a>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              返回首页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
