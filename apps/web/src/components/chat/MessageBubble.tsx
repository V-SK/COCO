import type { Message } from '@/types';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { ToolResultCard } from './ToolResultCard';
import avatarImg from '/coco-avatar.jpg?url';

/* ── lightweight markdown renderer ── */

function processInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const inlineRe =
    /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-white">
          {match[2]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={match.index}
          className="rounded bg-background/60 px-1.5 py-0.5 text-sm font-mono text-primary"
        >
          {match[4]}
        </code>,
      );
    } else if (match[6] !== undefined && match[7] !== undefined) {
      nodes.push(
        <a
          key={match.index}
          href={match[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {match[6]}
        </a>,
      );
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function renderMarkdown(text: string): ReactNode {
  const parts = text.split(/(```[\s\S]*?```)/g);
  const elements: ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;

    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const newlineIdx = inner.indexOf('\n');
      const code = newlineIdx >= 0 ? inner.slice(newlineIdx + 1) : inner;
      elements.push(
        <pre
          key={`code-${String(i)}`}
          className="my-2 overflow-x-auto rounded-lg bg-background p-3 text-sm font-mono"
        >
          <code>{code}</code>
        </pre>,
      );
    } else {
      const lines = part.split('\n');
      let inList = false;
      const listItems: ReactNode[] = [];

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (line === undefined) continue;
        const bulletMatch = line.match(/^[-*]\s+(.*)/);

        if (bulletMatch?.[1] !== undefined) {
          if (!inList) inList = true;
          listItems.push(
            <li key={`li-${String(i)}-${String(li)}`}>
              {processInline(bulletMatch[1])}
            </li>,
          );
        } else {
          if (inList) {
            elements.push(
              <ul
                key={`ul-${String(i)}-${String(li)}`}
                className="my-1 ml-4 list-disc"
              >
                {listItems.splice(0)}
              </ul>,
            );
            inList = false;
          }
          if (line.trim() !== '' || li < lines.length - 1) {
            elements.push(
              <span key={`line-${String(i)}-${String(li)}`}>
                {processInline(line)}
                {li < lines.length - 1 ? '\n' : ''}
              </span>,
            );
          }
        }
      }

      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`ul-${String(i)}-end`} className="my-1 ml-4 list-disc">
            {listItems}
          </ul>,
        );
      }
    }
  }

  return <>{elements}</>;
}

/* ── component ── */

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean | undefined;
  showAvatar?: boolean;
}

export function MessageBubble({
  message,
  isStreaming = false,
  showAvatar = true,
}: MessageBubbleProps) {
  const { content, role, toolId, toolParams, toolResult } = message;
  const isUser = role === 'user';
  const isTool = role === 'tool';

  if (isUser) {
    return (
      <div className="flex w-full animate-slide-in-right justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-surface px-4 py-3 text-[15px] leading-relaxed text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full animate-slide-in-left justify-start gap-2.5">
      {/* AI Avatar */}
      {showAvatar ? (
        <img
          src={avatarImg}
          alt="Coco"
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-primary/20"
        />
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div
        className={cn(
          'break-words text-[15px] leading-relaxed',
          isTool
            ? 'max-w-[calc(100%-42px)]'
            : 'max-w-[calc(85%-42px)] whitespace-pre-wrap text-neutral-100',
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
            {renderMarkdown(content)}
            {isStreaming ? (
              <span className="ml-0.5 inline-block animate-pulse text-primary">
                ▎
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
