import type { Message } from '@/types';
import { cn } from '@/utils/cn';
import { ToolResultCard } from './ToolResultCard';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean | undefined;
}

export function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  const { content, role, toolId, toolParams, toolResult } = message;
  const isUser = role === 'user';
  const isTool = role === 'tool';

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg shadow-black/10 animate-fade-in animate-slide-up sm:max-w-[80%]',
          isUser && 'rounded-br-sm bg-primary text-black',
          role === 'assistant' && 'rounded-bl-sm bg-surface text-white',
          isTool &&
            'rounded-bl-sm border border-border bg-background-secondary text-slate-300',
        )}
      >
        {isTool ? (
          <ToolResultCard
            toolId={toolId}
            toolParams={toolParams}
            result={toolResult}
            content={content}
          />
        ) : (
          <>
            {content}
            {isStreaming ? (
              <span className="ml-1 inline-block animate-pulse font-medium text-primary">
                ▌
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
