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
          // Update auth in this window's store
          setAuth({
            token: data.token,
            qualified: true,
            method: data.method,
            user: {
              wallet: '', // will be filled from localStorage
              twitter: data.twitter.username,
              avatar: data.twitter.avatar,
            },
          });

          setStatus('success');
          setMessage(`验证成功！欢迎 @${data.twitter.username}`);

          // Notify opener window and close popup
          if (window.opener) {
            window.opener.postMessage({ type: 'coco_twitter_auth', data }, '*');
            setTimeout(() => window.close(), 1500);
          }
        } else {
          setStatus('error');
          setMessage(
            data.isFollowing
              ? '验证失败，请稍后重试'
              : `请先关注 @COCO_DOGE 后重试`
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
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
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
        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
          >
            关闭窗口
          </button>
        )}
      </div>
    </div>
  );
}
