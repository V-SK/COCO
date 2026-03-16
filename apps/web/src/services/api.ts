import { API_BASE } from '@/config/constants';
import type { ToolDefinition } from '@/types';

export async function createSession(): Promise<{ sessionId: string }> {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  return (await response.json()) as { sessionId: string };
}

export async function getHealth(): Promise<{
  ok: boolean;
  chainId: number;
  walletMode: string;
  plugins: string[];
}> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return (await response.json()) as {
    ok: boolean;
    chainId: number;
    walletMode: string;
    plugins: string[];
  };
}

export async function getTools(): Promise<ToolDefinition[]> {
  const response = await fetch(`${API_BASE}/tools`);

  if (!response.ok) {
    throw new Error(`Failed to get tools: ${response.statusText}`);
  }

  const data = (await response.json()) as { tools: ToolDefinition[] };
  return data.tools;
}
