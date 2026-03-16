import type { PriceResultLike } from '@/types/toolResults';

interface PriceCardProps {
  result: PriceResultLike;
  summary?: string | undefined;
}

export function PriceCard({ result, summary }: PriceCardProps) {
  const changePercent =
    typeof result.changePercent24h === 'number' ? result.changePercent24h : null;
  const changeValue =
    typeof result.change24h === 'number' ? result.change24h : null;
  const changeTone =
    changePercent == null
      ? 'text-slate-300'
      : changePercent >= 0
        ? 'text-success'
        : 'text-error';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Price
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
            {result.symbol}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Latest
          </p>
          <p className="mt-1 text-2xl font-semibold text-primary sm:text-3xl">
            ${result.price.toFixed(4)}
          </p>
          <p className={`mt-2 text-sm font-medium ${changeTone}`}>
            {changePercent == null || changeValue == null
              ? '24h —'
              : `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(4)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`}
          </p>
        </div>
      </div>
      <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">24h High</p>
          <p className="mt-2 font-medium text-white">
            {typeof result.high24h === 'number' ? `$${result.high24h.toFixed(4)}` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">24h Low</p>
          <p className="mt-2 font-medium text-white">
            {typeof result.low24h === 'number' ? `$${result.low24h.toFixed(4)}` : '—'}
          </p>
        </div>
      </div>
      {summary ? (
        <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-slate-300">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
