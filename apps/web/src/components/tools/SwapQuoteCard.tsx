import { Badge } from '@/components/common/Badge';
import { useAccount } from 'wagmi';
import { useSwapStore } from '@/stores/swapStore';
import type { SwapExecuteResultLike } from '@/types/toolResults';

interface SwapQuoteCardProps {
  result: SwapExecuteResultLike;
  summary?: string | undefined;
  toolParams?: unknown;
}

function getSlippage(
  toolParams: unknown,
  quoteSlippage?: number | null,
) {
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Swap Quote
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            {result.quote.tokenIn.symbol} → {result.quote.tokenOut.symbol}
          </h3>
        </div>
        <Badge variant="primary">Unsigned Tx</Badge>
      </div>

      <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">From</p>
          <p className="mt-2 font-medium text-white">
            {result.quote.amountIn} {result.quote.tokenIn.symbol}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">To</p>
          <p className="mt-2 font-medium text-white">
            {result.quote.amountOut} {result.quote.tokenOut.symbol}
          </p>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Minimum</p>
          <p className="mt-2 font-medium text-white">
            {result.quote.amountOutMin ?? '—'} {result.quote.tokenOut.symbol}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Slippage</p>
          <p className="mt-2 font-medium text-white">{slippage}</p>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Price Impact</p>
          <p className="mt-2 font-medium text-white">{priceImpact}</p>
        </div>
      </div>

      {summary ? (
        <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-slate-300">
          {summary}
        </p>
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
        className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-black transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnected ? '确认交易' : '请先连接钱包'}
      </button>
    </div>
  );
}
