interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}

const MOCK_TICKERS: TickerItem[] = [
  { symbol: 'BTC', price: 84250.3, change: 2.15 },
  { symbol: 'ETH', price: 2329.76, change: -1.42 },
  { symbol: 'BNB', price: 678.55, change: 3.21 },
  { symbol: 'SOL', price: 94.53, change: 6.73 },
];

function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TickerChip({ item }: { item: TickerItem }) {
  const isPositive = item.change >= 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
      <span className="text-xs font-medium text-neutral-300">
        {item.symbol}
      </span>
      <span className="text-xs text-neutral-400">
        ${formatPrice(item.price)}
      </span>
      <span
        className={
          isPositive ? 'text-xs text-success' : 'text-xs text-error'
        }
      >
        {isPositive ? '+' : ''}
        {item.change.toFixed(2)}%
      </span>
    </span>
  );
}

export function Ticker() {
  /* Duplicate items for seamless marquee loop */
  const items = [...MOCK_TICKERS, ...MOCK_TICKERS];

  return (
    <div className="overflow-hidden border-b border-border/50 bg-background-secondary">
      <div className="ticker-scroll flex gap-3 px-3 py-1.5">
        {items.map((item, index) => (
          <TickerChip key={`${item.symbol}-${String(index)}`} item={item} />
        ))}
      </div>
    </div>
  );
}
