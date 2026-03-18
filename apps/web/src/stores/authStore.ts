import { create } from 'zustand';

export interface AuthUser {
  wallet: string;
  twitter?: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  qualified: boolean;
  method: string | null; // 'token' | 'twitter' | null
  balance: number;
  user: AuthUser | null;
  loading: boolean;

  setAuth: (data: {
    token: string;
    qualified: boolean;
    method: string | null;
    balance?: number;
    user: AuthUser;
  }) => void;
  logout: () => void;
  setLoading: (v: boolean) => void;
}

const STORAGE_KEY = 'coco_auth_token';
const USER_KEY = 'coco_auth_user';

function loadPersistedToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function loadPersistedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: loadPersistedToken(),
  qualified: false,
  method: null,
  balance: 0,
  user: loadPersistedUser(),
  loading: true,

  setAuth: (data) => {
    localStorage.setItem(STORAGE_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    set({
      token: data.token,
      qualified: data.qualified,
      method: data.method,
      balance: data.balance ?? 0,
      user: data.user,
      loading: false,
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      token: null,
      qualified: false,
      method: null,
      balance: 0,
      user: null,
      loading: false,
    });
  },

  setLoading: (v) => set({ loading: v }),
}));
