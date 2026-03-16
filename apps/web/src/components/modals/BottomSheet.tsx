import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 animate-fade-in">
      <button
        type="button"
        aria-label="关闭弹窗"
        onClick={onClose}
        className="absolute inset-0 h-full w-full"
      />
      <div
        className={cn(
          'safe-bottom absolute inset-x-0 bottom-0 animate-fade-in animate-slide-up rounded-t-[28px] border border-border bg-background-secondary p-5 shadow-2xl shadow-black/40 md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
