import type { TickerData } from '@/hooks/useBinanceTickers';

function formatPrice(price: number): string {
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TickerChip({ item }: { item: TickerData }) {
  const up = item.change24h >= 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1">
      <span className="text-xs font-semibold text-white">{item.symbol}</span>
      <span className="text-xs text-neutral-400">${formatPrice(item.price)}</span>
      <span className={`text-xs font-medium ${up ? 'text-success' : 'text-error'}`}>
        {up ? '↑' : '↓'}
        {up ? '+' : ''}
        {item.change24h.toFixed(2)}%
      </span>
    </span>
  );
}

export function Ticker({ tickers }: { tickers: TickerData[] }) {
  if (tickers.length === 0) return null;

  const items = [...tickers, ...tickers, ...tickers];

  return (
    <div className="relative shrink-0 overflow-hidden border-b border-border/30 bg-background-secondary/80">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background-secondary/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background-secondary/80 to-transparent" />
      <div className="ticker-scroll flex whitespace-nowrap">
        {items.map((item, index) => (
          <TickerChip key={`${item.symbol}-${String(index)}`} item={item} />
        ))}
      </div>
    </div>
  );
}
