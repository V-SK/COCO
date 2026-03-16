import { create } from 'zustand';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  variant: ToastVariant;
  visible: boolean;
  showToast: (message: string, variant?: ToastVariant) => void;
  hideToast: () => void;
}

export const useUiStore = create<ToastState>((set) => ({
  message: null,
  variant: 'info',
  visible: false,
  showToast: (message, variant = 'info') => {
    set({
      message,
      variant,
      visible: true,
    });
  },
  hideToast: () => {
    set({ visible: false, message: null });
  },
}));
