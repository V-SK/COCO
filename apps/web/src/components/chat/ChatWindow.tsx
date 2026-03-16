import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chatStore';
import { StatusDot } from '@/components/common/StatusDot';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

interface ChatWindowProps {
  backendReady: boolean;
}

export function ChatWindow({ backendReady }: ChatWindowProps) {
  const messages = useChatStore((state) => state.messages);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const pendingToolCall = useChatStore((state) => state.pendingToolCall);
  const { sendMessage, isConnected, isLoading, sessionId, error } = useChat();

  const disabled = !backendReady || !isConnected || !sessionId || isLoading;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-border bg-background-secondary/70 shadow-2xl shadow-black/15 sm:rounded-[28px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Chat
          </p>
          <h2 className="mt-1 text-lg font-medium text-white">Coco Assistant</h2>
        </div>
        <div className="text-right">
          <div className="flex justify-end">
            <StatusDot
              status={isConnected ? 'success' : 'warning'}
              label={isConnected ? 'Connected' : 'Connecting'}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {sessionId ? `Session ${sessionId.slice(0, 8)}...` : '正在创建会话'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="border-b border-error/50 bg-error/10 px-4 py-3 text-sm text-error sm:px-6">
          {error}
        </div>
      ) : null}

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        pendingToolCall={pendingToolCall}
      />
      <ChatInput disabled={disabled} isLoading={isLoading} onSend={sendMessage} />
    </section>
  );
}
