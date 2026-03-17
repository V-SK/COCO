import { ToolLoading } from '@/components/tools/ToolLoading';
import type { Message } from '@/types';
import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import welcomeImg from '/coco-welcome.jpg?url';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  pendingToolCall: { toolId: string; params: unknown } | null;
  onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = ['BNB 今天的信号', '查看可用工具', '当前市场概览'];

const GREETINGS = [
  '今天想看什么币？ ☀️',
  'BNB 生态有新动向，要聊聊吗？',
  '有什么可以帮你？',
  '随时准备为你服务 ✨',
  '市场永不眠，我也是 💎',
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了，还在看盘？ 🌙';
  if (hour < 12) return '早安！新的一天，新的机会 ☀️';
  if (hour < 18) return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return '晚上好，来看看今天的行情？ 🌆';
}

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
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 bg-black">
        {/* Character image */}
        <div className="animate-scale-in relative">
          <img
            src={welcomeImg}
            alt="Coco AI"
            className="h-48 w-auto object-contain sm:h-56"
          />
          {/* Glow behind character */}
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: 'radial-gradient(ellipse at 50% 60%, rgba(240,185,11,0.1) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Greeting */}
        <h2 className="mt-4 animate-fade-in-up text-xl font-medium tracking-tight text-white [animation-delay:100ms] [animation-fill-mode:backwards]">
          {getGreeting()}
        </h2>

        {/* Suggestions */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="animate-fade-in-up rounded-full border border-primary/20 px-4 py-2 text-[13px] text-neutral-400 transition-colors [animation-fill-mode:backwards] hover:border-primary/50 hover:text-primary active:scale-95"
              style={{ animationDelay: `${150 + index * 50}ms` }}
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
