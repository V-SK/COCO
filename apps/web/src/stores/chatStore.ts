import type { ChatEvent, Message } from '@/types';
import { create } from 'zustand';

const SESSION_KEY = 'coco-session-id';

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

    switch (event.type) {
      case 'text':
        appendToStreaming(event.content);
        break;
      case 'tool_call':
        finalizeStreaming();
        setPendingToolCall({
          toolId: event.toolId,
          params: event.params,
        });
        console.log('[Chat] Tool call:', event.toolId, event.params);
        break;
      case 'tool_result': {
        finalizeStreaming();
        setPendingToolCall(null);
        // Only show rich tool results (price, scan, swap) — others wait for LLM summary
        const RICH_TOOLS = new Set(['price.get', 'scan.contract', 'swap.execute']);
        if (RICH_TOOLS.has(event.toolId)) {
          addMessage({
            id: crypto.randomUUID(),
            role: 'tool',
            content: event.result.text || JSON.stringify(event.result.data),
            timestamp: Date.now(),
            toolId: event.toolId,
            toolParams: pendingToolCall?.params,
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
