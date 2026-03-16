import { StatusDot } from '@/components/common/StatusDot';
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

  return (
    <div className="safe-bottom sticky bottom-0 border-t border-border bg-background-secondary/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-3xl items-end gap-3">
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
          placeholder={
            disabled
              ? '聊天暂时不可用'
              : '输入消息，Enter 发送，Shift+Enter 换行'
          }
          className="min-h-[56px] flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-4 text-sm leading-6 text-white placeholder:text-slate-500 shadow-inner shadow-black/10 transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(240,185,11,0.15)]"
        />
        <button
          type="button"
          disabled={disabled || value.trim().length === 0}
          onClick={submit}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl text-black transition hover:bg-primary-hover active:animate-bounce-subtle disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="发送消息"
        >
          {isLoading ? (
            <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
          ) : (
            '↑'
          )}
        </button>
      </div>
      <div className="mx-auto mt-3 flex max-w-3xl items-center justify-between">
        <p className="text-xs text-slate-500">Shift+Enter 换行</p>
        <StatusDot
          status={disabled ? 'warning' : 'success'}
          label={disabled ? '发送不可用' : '准备发送'}
        />
      </div>
    </div>
  );
}
