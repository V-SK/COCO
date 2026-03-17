import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { QuickActions } from './QuickActions';

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
        <div className="mx-4 mt-2 shrink-0 flex items-center gap-2.5 rounded-xl bg-neutral-800/60 px-4 py-2 sm:mx-6">
          <span className="text-sm">⚡</span>
          <span className="text-xs text-neutral-400">服务连接中，请稍后再试</span>
        </div>
      ) : null}

      {/* Messages area — takes all remaining space, scrollable */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        pendingToolCall={pendingToolCall}
        onSuggestionClick={(text) => {
          if (!disabled) sendMessage(text);
        }}
      />

      {/* Quick actions + Input — always at bottom, never pushed away */}
      <div className="shrink-0">
        <QuickActions
          onSend={(text) => {
            if (!disabled) sendMessage(text);
          }}
        />
        <ChatInput
          disabled={disabled}
          isLoading={isLoading}
          onSend={sendMessage}
        />
      </div>
    </div>
  );
}
