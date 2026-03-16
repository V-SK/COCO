import { CocoLogo } from '@/components/common/CocoLogo';
import { ToolLoading } from '@/components/tools/ToolLoading';
import type { Message } from '@/types';
import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  pendingToolCall: { toolId: string; params: unknown } | null;
  onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = [
  'BNB 今天的信号',
  '查看可用工具',
  '当前市场概览',
];

export function MessageList({
  messages,
  streamingContent,
  pendingToolCall,
  onSuggestionClick,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6">
        <CocoLogo size={56} animate />
        <h2 className="mt-6 text-2xl font-medium tracking-tight text-white">
          有什么可以帮你？
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="rounded-full border border-border px-4 py-2 text-[13px] text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white active:scale-95"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {streamingContent ? (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingContent,
              timestamp: Date.now(),
            }}
            isStreaming
          />
        ) : null}
        {pendingToolCall ? (
          <ToolLoading toolId={pendingToolCall.toolId} />
        ) : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
