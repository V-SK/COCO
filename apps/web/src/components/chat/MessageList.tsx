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

/* Deterministic particle positions (no re-render flicker) */
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: 8 + (i * 37 + 13) % 84,
  top: 15 + (i * 53 + 7) % 65,
  size: 1.5 + (i % 3) * 1.2,
  duration: 3 + (i % 4) * 0.8,
  delay: (i * 0.4) % 3,
}));

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
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6">
        {/* Layered background */}
        <div className="pointer-events-none absolute inset-0">
          {/* Base gradient: black → deep blue-black */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, #000000 0%, #050a18 50%, #0a0e1a 100%)',
            }}
          />
          {/* Gold spotlight behind character */}
          <div
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '500px',
              height: '500px',
              background: 'radial-gradient(ellipse, rgba(240,185,11,0.08) 0%, rgba(240,185,11,0.03) 40%, transparent 70%)',
              animation: 'welcomeGlow 4s ease-in-out infinite',
            }}
          />
          {/* Bottom horizon glow */}
          <div
            className="absolute bottom-0 left-0 right-0 h-40"
            style={{
              background: 'radial-gradient(ellipse at 50% 100%, rgba(240,185,11,0.06) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                background: `rgba(240, 185, 11, ${0.2 + (i % 3) * 0.15})`,
                boxShadow: `0 0 ${p.size * 2}px rgba(240, 185, 11, 0.3)`,
                animation: `welcomeParticle ${p.duration}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Character image */}
          <div className="animate-scale-in relative">
            <img
              src={welcomeImg}
              alt="Coco AI"
              className="h-48 w-auto object-contain sm:h-56"
              style={{
                maskImage: 'radial-gradient(ellipse 90% 85% at 50% 45%, black 55%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 90% 85% at 50% 45%, black 55%, transparent 100%)',
              }}
            />
            {/* Character glow ring */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 scale-125"
              style={{
                background: 'radial-gradient(ellipse at 50% 55%, rgba(240,185,11,0.12) 0%, transparent 60%)',
                filter: 'blur(20px)',
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
                className="animate-fade-in-up rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[13px] text-neutral-300 backdrop-blur-sm transition-all [animation-fill-mode:backwards] hover:border-primary/40 hover:bg-primary/10 hover:text-white active:scale-95"
                style={{ animationDelay: `${150 + index * 50}ms` }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes welcomeGlow {
            0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
          }
          @keyframes welcomeParticle {
            0%, 100% { opacity: 0.3; transform: translateY(0); }
            50% { opacity: 0.8; transform: translateY(-10px); }
          }
        `}</style>
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
