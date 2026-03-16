import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

interface ChatWindowProps {
  backendReady: boolean;
  error?: string | null;
}

export function ChatWindow({ backendReady, error }: ChatWindowProps) {
  const messages = useChatStore((state) => state.messages);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const pendingToolCall = useChatStore((state) => state.pendingToolCall);
  const { sendMessage, isConnected, isLoading, sessionId } = useChat();

  const disabled = !backendReady || !isConnected || !sessionId || isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="mx-4 mt-2 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error sm:mx-6">
          {error}
        </div>
      ) : null}

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        pendingToolCall={pendingToolCall}
        onSuggestionClick={(text) => {
          if (!disabled) sendMessage(text);
        }}
      />
      <ChatInput
        disabled={disabled}
        isLoading={isLoading}
        onSend={sendMessage}
      />
    </div>
  );
}
