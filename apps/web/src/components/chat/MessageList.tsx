import { ToolLoading } from '@/components/tools/ToolLoading';
import type { Message } from '@/types';
import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  pendingToolCall: { toolId: string; params: unknown } | null;
}

const SUGGESTIONS = [
  '帮我看一下 BNB 今天的信号',
  '查询当前可用工具',
  '给我一份当前市场概览',
];

export function MessageList({
  messages,
  streamingContent,
  pendingToolCall,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="max-w-2xl rounded-3xl border border-border bg-gradient-to-br from-background-secondary via-background-secondary to-background p-6 text-center shadow-xl shadow-black/10 sm:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            Welcome
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            开始和 Coco 对话
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            你可以直接询问信号、价格、风险、工具能力，后端会通过 connector-web
            流式返回结果。
          </p>
          <div className="mt-6 space-y-2 text-left text-sm text-slate-300">
            {SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion}
                className="rounded-2xl border border-border bg-background px-4 py-3 transition hover:border-border-light"
              >
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-3xl flex-col space-y-4">
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
