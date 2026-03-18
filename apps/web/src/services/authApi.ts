import { API_BASE } from '@/config/constants';


export async function getNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error('Failed to get nonce');
  return (await res.json()) as { nonce: string; message: string };
}
export interface WalletAuthResponse {
  token: string;
  qualified: boolean;
  method: string | null;
  balance: number;
  needsTwitter?: boolean;
  user: {
    wallet: string;
    twitter?: string;
    avatar?: string;
  };
}

export interface TwitterAuthUrlResponse {
  url: string;
}

export interface TwitterCallbackResponse {
  token: string;
  qualified: boolean;
  method: string | null;
  isFollowing: boolean;
  twitter: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export interface AuthCheckResponse {
  qualified: boolean;
  method: string | null;
  balance: number;
  user: {
    wallet: string;
    twitter?: string;
    avatar?: string;
  };
}

export async function authWallet(address: string, signature?: string): Promise<WalletAuthResponse> {
  const res = await fetch(`${API_BASE}/auth/wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature }),
  });
  if (!res.ok) throw new Error('Wallet auth failed');
  return (await res.json()) as WalletAuthResponse;
}

export async function getTwitterAuthUrl(wallet: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/twitter${wallet ? '?wallet=' + encodeURIComponent(wallet) : ''}`);
  if (!res.ok) throw new Error('Failed to get Twitter auth URL');
  const data = (await res.json()) as TwitterAuthUrlResponse;
  return data.url;
}

export async function twitterCallback(code: string, state: string): Promise<TwitterCallbackResponse> {
  const res = await fetch(`${API_BASE}/auth/twitter/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) throw new Error('Twitter callback failed');
  return (await res.json()) as TwitterCallbackResponse;
}

export async function checkAuth(token: string): Promise<AuthCheckResponse> {
  const res = await fetch(`${API_BASE}/auth/check`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Auth check failed');
  return (await res.json()) as AuthCheckResponse;
}
