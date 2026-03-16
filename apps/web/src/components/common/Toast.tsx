import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { Badge } from './Badge';

export function Toast() {
  const message = useUiStore((state) => state.message);
  const variant = useUiStore((state) => state.variant);
  const visible = useUiStore((state) => state.visible);
  const hideToast = useUiStore((state) => state.hideToast);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      hideToast();
    }, 2400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hideToast, visible]);

  if (!visible || !message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="animate-toast-in rounded-2xl border border-border bg-background-secondary/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <Badge
            variant={
              variant === 'success'
                ? 'success'
                : variant === 'error'
                  ? 'error'
                  : 'primary'
            }
          >
            {variant === 'success'
              ? '成功'
              : variant === 'error'
                ? '错误'
                : '提示'}
          </Badge>
          <p className="text-sm text-slate-100">{message}</p>
        </div>
      </div>
    </div>
  );
}
