import type { ChatEvent, Message } from '@/types';
import { create } from 'zustand';

const SESSION_KEY = 'coco-session-id';
const SESSIONS_KEY = 'coco-sessions';

export interface SessionInfo {
  id: string;
  title: string;
  updatedAt: number;
}

function loadSessions(): SessionInfo[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as SessionInfo[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionInfo[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function ensureCurrentSession(sessionId: string, sessions: SessionInfo[]): SessionInfo[] {
  if (sessions.some((s) => s.id === sessionId)) return sessions;
  return [{ id: sessionId, title: '新对话', updatedAt: Date.now() }, ...sessions];
}

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isConnected: boolean;
  sessionId: string;
  error: string | null;
  streamingContent: string;
  pendingToolCall: { toolId: string; params: unknown } | null;
  setSessionId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPendingToolCall: (
    pendingToolCall: { toolId: string; params: unknown } | null,
  ) => void;
  addMessage: (message: Message) => void;
  addUserMessage: (content: string) => void;
  appendToStreaming: (content: string) => void;
  finalizeStreaming: () => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;
  sessions: SessionInfo[];
  startNewChat: () => void;
  switchSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  handleChatEvent: (event: ChatEvent) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isConnected: false,
  sessionId: getOrCreateSessionId(),
  error: null,
  streamingContent: '',
  pendingToolCall: null,
  sessions: ensureCurrentSession(getOrCreateSessionId(), loadSessions()),

  setSessionId: (id) => {
    localStorage.setItem(SESSION_KEY, id);
    set({ sessionId: id });
  },
  setConnected: (connected) => {
    set({ isConnected: connected });
  },
  setLoading: (loading) => {
    set({ isLoading: loading });
  },
  setError: (error) => {
    set({ error });
  },
  setPendingToolCall: (pendingToolCall) => {
    set({ pendingToolCall });
  },
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },
  addUserMessage: (content) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ],
    }));
  },
  appendToStreaming: (content) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
    }));
  },
  finalizeStreaming: () => {
    const { messages, streamingContent } = get();
    if (!streamingContent) {
      return;
    }

    set({
      messages: [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: streamingContent,
          timestamp: Date.now(),
        },
      ],
      streamingContent: '',
    });
  },
  clearMessages: () => {
    set({ messages: [], streamingContent: '' });
  },
  setMessages: (messages) => {
    set({ messages });
  },
  startNewChat: () => {
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, newId);
    const sessions = ensureCurrentSession(newId, get().sessions);
    saveSessions(sessions);
    set({
      sessionId: newId,
      messages: [],
      streamingContent: '',
      pendingToolCall: null,
      error: null,
      isLoading: false,
      sessions,
    });
  },

  switchSession: (id: string) => {
    localStorage.setItem(SESSION_KEY, id);
    set({
      sessionId: id,
      messages: [],
      streamingContent: '',
      pendingToolCall: null,
      error: null,
      isLoading: false,
    });
  },

  updateSessionTitle: (id: string, title: string) => {
    const sessions = get().sessions.map((s) =>
      s.id === id ? { ...s, title, updatedAt: Date.now() } : s
    );
    saveSessions(sessions);
    set({ sessions });
  },

  handleChatEvent: (event) => {
    const {
      addMessage,
      appendToStreaming,
      finalizeStreaming,
      pendingToolCall,
      setPendingToolCall,
      setError,
      setLoading,
    } = get();

    const RICH_TOOLS = new Set(['price.get', 'scan.contract', 'swap.execute']);

    switch (event.type) {
      case 'text': {
        appendToStreaming(event.content);
        break;
      }
      case 'tool_call': {
        finalizeStreaming();
        setPendingToolCall({
          toolId: event.toolId,
          params: event.params,
        });
        console.log('[Chat] Tool call:', event.toolId, event.params);
        break;
      }
      case 'tool_result': {
        finalizeStreaming();
        const capturedParams = pendingToolCall?.params;
        setPendingToolCall(null);
        if (RICH_TOOLS.has(event.toolId)) {
          addMessage({
            id: crypto.randomUUID(),
            role: 'tool',
            content: event.result.text || JSON.stringify(event.result.data),
            timestamp: Date.now(),
            toolId: event.toolId,
            toolParams: capturedParams,
            toolResult: event.result,
          });
        }
        break;
      }
      case 'error':
        finalizeStreaming();
        setPendingToolCall(null);
        setError(event.error);
        setLoading(false);
        break;
      case 'done':
        finalizeStreaming();
        setLoading(false);
        break;
      default:
        break;
    }
  },
}));
