import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';

interface ChatInputProps {
  disabled: boolean;
  isLoading: boolean;
  onSend: (message: string, walletAddress?: string) => void;
}

export function ChatInput({ disabled, isLoading, onSend }: ChatInputProps) {
  const { address } = useAccount();
  const [value, setValue] = useState('');
  const isComposingRef = useRef(false);
  const lastCompositionEndRef = useRef(0);

  function submit() {
    const content = value.trim();
    if (!content || disabled) {
      return;
    }

    onSend(content, address);
    setValue('');
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="safe-bottom px-3 pb-2 pt-1 sm:px-4">
      <div className="mx-auto flex max-w-2xl items-end gap-0 rounded-[20px] bg-surface">
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            lastCompositionEndRef.current = Date.now();
          }}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent as KeyboardEvent & {
              isComposing?: boolean;
              keyCode?: number;
            };
            const justFinishedComposition =
              Date.now() - lastCompositionEndRef.current < 50;
            const isImeEnter =
              nativeEvent.isComposing ||
              isComposingRef.current ||
              nativeEvent.keyCode === 229 ||
              justFinishedComposition;

            if (event.key === 'Enter' && !event.shiftKey && !isImeEnter) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={disabled ? '连接中...' : '和 Coco 聊天'}
          className="min-h-[48px] flex-1 resize-none bg-transparent px-4 py-3.5 text-[15px] leading-5 text-white placeholder:text-neutral-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={submit}
          className="mb-1.5 mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-neutral-200 active:scale-90 disabled:bg-neutral-700 disabled:text-neutral-500"
          aria-label="发送消息"
        >
          {isLoading ? (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-black" />
          ) : (
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
