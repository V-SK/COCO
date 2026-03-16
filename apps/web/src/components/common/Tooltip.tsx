import type { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-border bg-background px-3 py-2 text-xs text-neutral-200 shadow-xl shadow-black/20 group-hover:block">
        {content}
      </span>
    </span>
  );
}
