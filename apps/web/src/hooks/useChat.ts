import { createSession } from '@/services/api';
import type { ChatConnection } from '@/services/ws';
import { connectChat } from '@/services/ws';
import { useChatStore } from '@/stores/chatStore';
import { useEffect, useRef } from 'react';

let sessionPromise: Promise<string> | null = null;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useChat() {
  const sessionId = useChatStore((state) => state.sessionId);
  const isConnected = useChatStore((state) => state.isConnected);
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const setConnected = useChatStore((state) => state.setConnected);
  const setLoading = useChatStore((state) => state.setLoading);
  const setError = useChatStore((state) => state.setError);
  const addUserMessage = useChatStore((state) => state.addUserMessage);
  const handleChatEvent = useChatStore((state) => state.handleChatEvent);
  const connectionRef = useRef<ChatConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (sessionId) {
      return undefined;
    }

    if (!sessionPromise) {
      sessionPromise = createSession().then((response) => response.sessionId);
    }

    sessionPromise
      .then((createdSessionId) => {
        if (cancelled) {
          return;
        }

        console.log('[Chat] Session ready:', createdSessionId);
        setSessionId(createdSessionId);
      })
      .catch((caughtError: unknown) => {
        if (cancelled) {
          return;
        }

        sessionPromise = null;
        setLoading(false);
        setError(toErrorMessage(caughtError, 'Failed to create session.'));
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, setError, setLoading, setSessionId]);

  useEffect(() => {
    if (!sessionId || connectionRef.current) {
      return undefined;
    }

    const connection = connectChat(sessionId, {
      onMessage: (event) => {
        handleChatEvent(event);
      },
      onOpen: () => {
        connectionRef.current = connection;
        setConnected(true);
      },
      onClose: () => {
        connectionRef.current = null;
        setConnected(false);
      },
      onError: () => {
        connectionRef.current = null;
        setConnected(false);
        setLoading(false);
        setError('WebSocket 连接失败。');
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

    if (!content) {
      return;
    }

    if (!connectionRef.current || !sessionId) {
      setError('聊天连接尚未就绪。');
      return;
    }

    addUserMessage(content);
    setError(null);
    setLoading(true);
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
