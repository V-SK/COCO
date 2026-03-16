import { WS_URL } from '@/config/constants';
import type { ChatEvent } from '@/types';

export interface ChatConnection {
  send: (message: string, walletAddress?: string) => void;
  close: () => void;
}

function resolveWsUrl(): string {
  if (!WS_URL.startsWith('/')) {
    return WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}${WS_URL}`;
}

export function connectChat(
  sessionId: string,
  callbacks: {
    onMessage: (event: ChatEvent) => void;
    onOpen?: (() => void) | undefined;
    onClose?: (() => void) | undefined;
    onError?: ((error: Event) => void) | undefined;
  },
): ChatConnection {
  const socket = new WebSocket(resolveWsUrl());

  socket.onopen = () => {
    console.log('[WS] Connected');
    callbacks.onOpen?.();
  };

  socket.onmessage = (incomingMessage) => {
    try {
      const event = JSON.parse(incomingMessage.data) as ChatEvent;
      callbacks.onMessage(event);
    } catch (error) {
      console.error('[WS] Parse error:', error);
    }
  };

  socket.onclose = () => {
    console.log('[WS] Disconnected');
    callbacks.onClose?.();
  };

  socket.onerror = (error) => {
    console.error('[WS] Error:', error);
    callbacks.onError?.(error);
  };

  return {
    send(message: string, walletAddress?: string) {
      if (socket.readyState !== WebSocket.OPEN) {
        console.error('[WS] Cannot send, socket is not open');
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'chat',
          sessionId,
          walletAddress,
          message,
        }),
      );
    },
    close() {
      socket.close();
    },
  };
}
