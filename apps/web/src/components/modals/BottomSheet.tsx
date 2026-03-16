import type { ReactNode } from 'react';

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
    <div className="fixed inset-0 z-50 animate-fade-in bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭弹窗"
        onClick={onClose}
        className="absolute inset-0 h-full w-full"
      />
      <div className="safe-bottom absolute inset-x-0 bottom-0 animate-slide-up rounded-t-2xl bg-background-secondary p-5 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl">
        {children}
      </div>
    </div>
  );
}
