import { useUiStore } from '@/stores/uiStore';
import { haptic } from '@/utils/haptics';
import { useEffect, useState } from 'react';

const TABS = [
  {
    key: 'chat' as const,
    label: '对话',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    key: 'market' as const,
    label: '行情',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
  {
    key: 'trading' as const,
    label: 'AI 交易',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const handler = () => setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav className="safe-bottom shrink-0 border-t border-border/40 bg-background-secondary/90 backdrop-blur-lg">
      <div className="flex items-center justify-around">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { haptic(); setActiveTab(tab.key); }}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors"
            >
              <span className={active ? 'text-primary' : 'text-neutral-500'}>{tab.icon}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-neutral-500'}`}>
                {tab.label}
              </span>
              {active ? (
                <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px_rgba(240,185,11,0.5)]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
