import { create } from 'zustand';

type ToastVariant = 'success' | 'error' | 'info';

interface UiState {
  message: string | null;
  variant: ToastVariant;
  visible: boolean;
  sidebarOpen: boolean;
  showToast: (message: string, variant?: ToastVariant) => void;
  hideToast: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  message: null,
  variant: 'info',
  visible: false,
  sidebarOpen: false,
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
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },
}));
