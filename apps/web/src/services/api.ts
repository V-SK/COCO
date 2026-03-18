import { API_BASE } from '@/config/constants';
import type { ToolDefinition } from '@/types';

export async function createSession(sessionId?: string): Promise<{ sessionId: string }> {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  return (await response.json()) as { sessionId: string };
}

export interface ServerMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export async function fetchMessages(
  sessionId: string,
  limit = 50,
  before?: number,
): Promise<ServerMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', String(before));
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }
  const data = (await response.json()) as { messages: ServerMessage[] };
  return data.messages;
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
