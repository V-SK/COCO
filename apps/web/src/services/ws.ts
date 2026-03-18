import { WS_URL } from '@/config/constants';
import type { ChatEvent } from '@/types';

export interface ChatConnection {
  send: (message: string, walletAddress?: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

function resolveWsUrl(): string {
  if (!WS_URL.startsWith('/')) {
    return WS_URL;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}${WS_URL}`;
}

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function connectChat(
  sessionId: string,
  callbacks: {
    onMessage: (event: ChatEvent) => void;
    onOpen?: (() => void) | undefined;
    onClose?: (() => void) | undefined;
    onError?: ((error: Event) => void) | undefined;
    onReconnecting?: ((attempt: number) => void) | undefined;
  },
): ChatConnection {
  let socket: WebSocket | null = null;
  let reconnectDelay = INITIAL_RECONNECT_DELAY;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let intentionalClose = false;
  let pendingMessages: Array<{ message: string; walletAddress?: string }> = [];

  function connect() {
    socket = new WebSocket(resolveWsUrl());

    socket.onopen = () => {
      console.log('[WS] Connected');
      reconnectDelay = INITIAL_RECONNECT_DELAY;
      reconnectAttempt = 0;
      callbacks.onOpen?.();

      // Flush pending messages
      if (pendingMessages.length > 0 && socket?.readyState === WebSocket.OPEN) {
        const queue = [...pendingMessages];
        pendingMessages = [];
        for (const msg of queue) {
          socket.send(
            JSON.stringify({
              type: 'chat',
              sessionId,
              walletAddress: msg.walletAddress,
              message: msg.message,
            }),
          );
        }
      }
    };

    socket.onmessage = (incoming) => {
      try {
        const event = JSON.parse(incoming.data) as ChatEvent;
        callbacks.onMessage(event);
      } catch (error) {
        console.error('[WS] Parse error:', error);
      }
    };

    socket.onclose = () => {
      console.log('[WS] Disconnected');
      callbacks.onClose?.();

      if (!intentionalClose) {
        scheduleReconnect();
      }
    };

    socket.onerror = (error) => {
      console.error('[WS] Error:', error);
      callbacks.onError?.(error);
    };
  }

  function scheduleReconnect() {
    if (intentionalClose) return;
    reconnectAttempt++;
    callbacks.onReconnecting?.(reconnectAttempt);
    console.log(`[WS] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempt})`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);

    // Exponential backoff with jitter
    reconnectDelay = Math.min(
      MAX_RECONNECT_DELAY,
      reconnectDelay * 1.5 + Math.random() * 500,
    );
  }

  // Also reconnect when the page becomes visible again (iOS background kill)
  function onVisibilityChange() {
    if (
      document.visibilityState === 'visible' &&
      !intentionalClose &&
      socket?.readyState !== WebSocket.OPEN &&
      socket?.readyState !== WebSocket.CONNECTING
    ) {
      console.log('[WS] Page visible, reconnecting...');
      reconnectDelay = INITIAL_RECONNECT_DELAY;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connect();
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  // Initial connect
  connect();

  return {
    send(message: string, walletAddress?: string) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'chat',
            sessionId,
            walletAddress,
            message,
          }),
        );
      } else {
        // Queue message for when reconnected
        pendingMessages.push({ message, walletAddress });
        console.log('[WS] Message queued, waiting for reconnect...');
      }
    },
    close() {
      intentionalClose = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      socket?.close();
    },
    isOpen() {
      return socket?.readyState === WebSocket.OPEN;
    },
  };
}
