import { useSwapStore } from '@/stores/swapStore';
import type { SwapExecuteResultLike } from '@/types/toolResults';
import { useAccount } from 'wagmi';

interface SwapQuoteCardProps {
  result: SwapExecuteResultLike;
  summary?: string | undefined;
  toolParams?: unknown;
}

function getSlippage(toolParams: unknown, quoteSlippage?: number | null) {
  if (typeof quoteSlippage === 'number') {
    return `${(quoteSlippage / 100).toFixed(2)}%`;
  }

  if (
    toolParams &&
    typeof toolParams === 'object' &&
    'slippageBps' in toolParams &&
    typeof toolParams.slippageBps === 'number'
  ) {
    return `${(toolParams.slippageBps / 100).toFixed(2)}%`;
  }

  return '—';
}

export function SwapQuoteCard({
  result,
  summary,
  toolParams,
}: SwapQuoteCardProps) {
  const { isConnected } = useAccount();
  const setPendingSwap = useSwapStore((state) => state.setPendingSwap);
  const slippage = getSlippage(toolParams, result.quote.slippageBps);
  const priceImpact =
    typeof result.quote.priceImpact === 'number'
      ? `${result.quote.priceImpact.toFixed(2)}%`
      : '—';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400">Swap Quote</p>
          <h3 className="mt-0.5 text-base font-semibold text-white">
            {result.quote.tokenIn.symbol} → {result.quote.tokenOut.symbol}
          </h3>
        </div>
        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">
          Unsigned
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-background/60 px-3 py-2">
          <p className="text-xs text-neutral-500">From</p>
          <p className="mt-1 font-medium text-white">
            {result.quote.amountIn} {result.quote.tokenIn.symbol}
          </p>
        </div>
        <div className="rounded-lg bg-background/60 px-3 py-2">
          <p className="text-xs text-neutral-500">To</p>
          <p className="mt-1 font-medium text-white">
            {result.quote.amountOut} {result.quote.tokenOut.symbol}
          </p>
        </div>
      </div>

      <div className="flex gap-2 text-xs text-neutral-400">
        <span>
          Min: {result.quote.amountOutMin ?? '—'} {result.quote.tokenOut.symbol}
        </span>
        <span>·</span>
        <span>Slippage: {slippage}</span>
        <span>·</span>
        <span>Impact: {priceImpact}</span>
      </div>

      {summary ? (
        <p className="text-xs leading-5 text-neutral-400">{summary}</p>
      ) : null}

      <button
        type="button"
        disabled={!isConnected}
        onClick={() => {
          setPendingSwap({
            quote: result.quote,
            tx: result.tx,
          });
        }}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-black transition hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
      >
        {isConnected ? '确认交易' : '请先连接钱包'}
      </button>
    </div>
  );
}
