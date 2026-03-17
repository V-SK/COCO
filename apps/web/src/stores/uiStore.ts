import { create } from 'zustand';

type ToastVariant = 'success' | 'error' | 'info';
type TabKey = 'chat' | 'market' | 'trading';

interface UiState {
  message: string | null;
  variant: ToastVariant;
  visible: boolean;
  sidebarOpen: boolean;
  activeTab: TabKey;
  showToast: (message: string, variant?: ToastVariant) => void;
  hideToast: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: TabKey) => void;
}

export const useUiStore = create<UiState>((set) => ({
  message: null,
  variant: 'info',
  visible: false,
  sidebarOpen: false,
  activeTab: 'chat',
  showToast: (message, variant = 'info') => {
    set({ message, variant, visible: true });
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
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
}));
