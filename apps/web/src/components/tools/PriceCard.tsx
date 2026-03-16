import type { PriceResultLike } from '@/types/toolResults';

interface PriceCardProps {
  result: PriceResultLike;
  summary?: string | undefined;
}

export function PriceCard({ result, summary }: PriceCardProps) {
  const changePercent =
    typeof result.changePercent24h === 'number'
      ? result.changePercent24h
      : null;
  const changeValue =
    typeof result.change24h === 'number' ? result.change24h : null;
  const changeTone =
    changePercent == null
      ? 'text-neutral-400'
      : changePercent >= 0
        ? 'text-success'
        : 'text-error';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400">Price</p>
          <h3 className="mt-0.5 text-lg font-semibold text-white">
            {result.symbol}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-primary">
            ${result.price.toFixed(4)}
          </p>
          <p className={`mt-1 text-xs font-medium ${changeTone}`}>
            {changePercent == null || changeValue == null
              ? '24h —'
              : `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(4)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-background/60 px-3 py-2">
          <p className="text-xs text-neutral-500">24h High</p>
          <p className="mt-1 font-medium text-white">
            {typeof result.high24h === 'number'
              ? `$${result.high24h.toFixed(4)}`
              : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-background/60 px-3 py-2">
          <p className="text-xs text-neutral-500">24h Low</p>
          <p className="mt-1 font-medium text-white">
            {typeof result.low24h === 'number'
              ? `$${result.low24h.toFixed(4)}`
              : '—'}
          </p>
        </div>
      </div>
      {summary ? (
        <p className="text-xs leading-5 text-neutral-400">{summary}</p>
      ) : null}
    </div>
  );
}
