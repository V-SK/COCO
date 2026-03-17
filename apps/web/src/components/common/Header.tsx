import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { haptic } from '@/utils/haptics';

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

export function Header() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const clearMessages = useChatStore((state) => state.clearMessages);

  return (
    <header
      className="flex shrink-0 items-center justify-between bg-background px-3 py-2.5"
      style={isElectron ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
    >
      <div
        className="flex items-center gap-1"
        style={isElectron ? { paddingLeft: 68, WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
      >
        {/* Hamburger menu */}
        <button
          type="button"
          onClick={() => { haptic(); toggleSidebar(); }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
          aria-label="打开侧边栏"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        {/* New chat button */}
        <button
          type="button"
          onClick={() => { haptic(); clearMessages(); }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
          aria-label="新对话"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
      <span className="text-sm font-medium text-neutral-200">Coco</span>
      {/* Right spacer to center title */}
      <div className="w-[76px]" />
    </header>
  );
}
