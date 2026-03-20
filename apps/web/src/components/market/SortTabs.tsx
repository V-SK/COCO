import type { SortMode } from '@/hooks/useDexTrending';
import { useEffect, useRef, useState } from 'react';

const TABS: { id: SortMode; label: string; icon: string }[] = [
  { id: 'hot', label: '热门', icon: '🔥' },
  { id: 'gainers', label: '涨幅', icon: '📈' },
  { id: 'mcap', label: '市值', icon: '💰' },
  { id: 'newest', label: '最新', icon: '🆕' },
];

export function SortTabs({
  active,
  onChange,
}: {
  active: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /* Measure and move the sliding indicator */
  useEffect(() => {
    const el = tabRefs.current.get(active);
    const container = containerRef.current;
    if (!el || !container) return;

    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setIndicator({
      left: eRect.left - cRect.left,
      width: eRect.width,
    });
  }, [active]);

  return (
    <div ref={containerRef} className="relative flex gap-1">
      {/* Sliding underline indicator */}
      <div
        className="absolute bottom-0 h-[2px] rounded-full bg-primary transition-all duration-300 ease-out"
        style={{
          left: indicator.left,
          width: indicator.width,
          opacity: indicator.width > 0 ? 1 : 0,
        }}
      />

      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`
              relative flex items-center gap-1 rounded-lg px-3 py-2
              text-xs font-medium
              transition-colors duration-200
              ${isActive ? 'text-primary' : 'text-neutral-500 hover:text-neutral-300'}
            `}
          >
            <span className="text-[11px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
