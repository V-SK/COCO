import { useChatStore } from '@/stores/chatStore';
import { useUiStore } from '@/stores/uiStore';
import { CocoLogo } from './CocoLogo';

export function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const messages = useChatStore((state) => state.messages);

  function handleNewChat() {
    clearMessages();
    setSidebarOpen(false);
  }

  return (
    <>
      {/* Backdrop overlay — mobile only */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSidebarOpen(false);
          }}
          role="button"
          tabIndex={-1}
          aria-label="关闭侧边栏"
        />
      ) : null}

      {/* Desktop spacer — reserves width for the sidebar in the flex layout */}
      <div
        className={`hidden transition-all duration-200 ease-out lg:block ${
          sidebarOpen ? 'w-[260px]' : 'w-0'
        }`}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-background-secondary transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top section */}
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <CocoLogo size={24} />
            <span className="text-sm font-semibold text-white">Coco</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-surface hover:text-white"
            aria-label="关闭侧边栏"
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
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-neutral-300 transition hover:bg-surface hover:text-white"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            新对话
          </button>
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {messages.length > 0 ? (
            <div className="space-y-0.5">
              <p className="px-2 pb-2 text-xs font-medium text-neutral-500">
                当前对话
              </p>
              <div className="rounded-lg bg-surface/50 px-3 py-2.5 text-sm text-white">
                {messages
                  .find((m) => m.role === 'user')
                  ?.content.slice(0, 40) ?? '对话进行中...'}
                {(messages.find((m) => m.role === 'user')?.content.length ??
                  0) > 40
                  ? '...'
                  : ''}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-neutral-500">暂无对话记录</p>
              <p className="mt-1 text-xs text-neutral-600">开始新对话吧</p>
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-neutral-500">
            <div className="h-2 w-2 rounded-full bg-success" />
            Coco AI v1.2
          </div>
        </div>
      </aside>
    </>
  );
}
