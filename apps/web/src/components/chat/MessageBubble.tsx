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

  if (isUser) {
    return (
      <div className="flex w-full animate-fade-in justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-surface px-4 py-3 text-[15px] leading-relaxed text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full animate-fade-in justify-start">
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words text-[15px] leading-relaxed',
          isTool
            ? 'rounded-2xl bg-surface px-4 py-3 text-neutral-200'
            : 'text-neutral-100',
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
              <span className="ml-0.5 inline-block animate-pulse text-teal-400">
                ▎
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
