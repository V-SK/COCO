import { createSession, fetchMessages } from '@/services/api';
import { saveMessageLocal, getMessagesLocal } from '@/services/chatDb';
import type { ChatConnection } from '@/services/ws';
import { connectChat } from '@/services/ws';
import { useChatStore } from '@/stores/chatStore';
import { useEffect, useRef } from 'react';
import type { Message } from '@/types';

export function useChat() {
  const sessionId = useChatStore((state) => state.sessionId);
  const isConnected = useChatStore((state) => state.isConnected);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const setConnected = useChatStore((state) => state.setConnected);
  const setLoading = useChatStore((state) => state.setLoading);
  const setError = useChatStore((state) => state.setError);
  const addUserMessage = useChatStore((state) => state.addUserMessage);
  const handleChatEvent = useChatStore((state) => state.handleChatEvent);
  const setMessages = useChatStore((state) => state.setMessages);
  const connectionRef = useRef<ChatConnection | null>(null);
  const restoredRef = useRef(false);

  // ── Restore messages on mount / visibility change ──────────
  useEffect(() => {
    if (!sessionId) return;

    async function restoreMessages() {
      try {
        // 1. Try IndexedDB first (instant)
        const local = await getMessagesLocal(sessionId);
        if (local.length > 0) {
          const restored: Message[] = local.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }));
          setMessages(restored);
        }

        // 2. Always sync from server (source of truth)
        try {
          const server = await fetchMessages(sessionId, 100);
          if (server.length > 0) {
            const serverMessages: Message[] = server.map((m) => ({
              id: m.id,
              role: m.role as Message['role'],
              content: m.content,
              timestamp: m.createdAt,
            }));
            setMessages(serverMessages);
            for (const m of server) {
              await saveMessageLocal({
                id: m.id,
                sessionId: m.sessionId,
                role: m.role,
                content: m.content,
                timestamp: m.createdAt,
              });
            }
          }
        } catch {
          console.warn('[Chat] Server sync failed, using local cache');
        }
      } catch (e) {
        console.error('[Chat] Restore failed:', e);
      }
    }

    // Restore on initial mount
    if (!restoredRef.current) {
      restoredRef.current = true;
      restoreMessages();
    }

    // iOS: restore when app comes back from background
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        restoreMessages();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sessionId, setMessages]);

  // ── Confirm session on server ──────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    createSession(sessionId).catch(() => {
      console.warn('[Chat] Session confirm failed');
    });
  }, [sessionId]);

  // ── WebSocket connection with auto-reconnect ───────────────
  useEffect(() => {
    if (!sessionId || connectionRef.current) {
      return undefined;
    }

    const connection = connectChat(sessionId, {
      onMessage: (event) => {
        handleChatEvent(event);

        // Persist assistant finalized text to IndexedDB
        if (event.type === 'done') {
          const messages = useChatStore.getState().messages;
          const last = messages[messages.length - 1];
          if (last && last.role === 'assistant') {
            saveMessageLocal({
              id: last.id,
              sessionId,
              role: 'assistant',
              content: last.content,
              timestamp: last.timestamp,
            }).catch(() => {});
          }
        }
      },
      onOpen: () => {
        setConnected(true);
        setError(null);
      },
      onClose: () => {
        setConnected(false);
        // If was loading (streaming interrupted), cancel loading state
        if (useChatStore.getState().isLoading) {
          setLoading(false);
          const { streamingContent, messages } = useChatStore.getState();
          // Finalize any partial streaming content
          if (streamingContent) {
            useChatStore.getState().finalizeStreaming();
          }
        }
      },
      onError: () => {
        // Auto-reconnect handles this, don't set permanent error
      },
      onReconnecting: (attempt) => {
        if (attempt <= 3) {
          setError('连接中断，正在重连...');
        } else {
          setError('连接中断，请检查网络后刷新页面');
        }
      },
    });

    connectionRef.current = connection;

    return () => {
      connection.close();
      connectionRef.current = null;
      setConnected(false);
    };
  }, [handleChatEvent, sessionId, setConnected, setError, setLoading]);

  function sendMessage(message: string, walletAddress?: string) {
    const content = message.trim();
    if (!content) return;

    if (!connectionRef.current || !sessionId) {
      setError('聊天连接尚未就绪。');
      return;
    }

    const msgId = crypto.randomUUID();
    addUserMessage(content);
    setError(null);
    setLoading(true);

    // Persist user message to IndexedDB
    saveMessageLocal({
      id: msgId,
      sessionId,
      role: 'user',
      content,
      timestamp: Date.now(),
    }).catch(() => {});

    // send() now queues if disconnected, will flush on reconnect
    connectionRef.current.send(content, walletAddress);
  }

  return {
    sendMessage,
    isConnected,
    isLoading,
    sessionId,
    error,
  };
}
