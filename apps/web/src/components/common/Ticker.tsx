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
  { symbol: 'DOGE', price: 0.1247, change: -0.83 },
  { symbol: 'ADA', price: 0.6821, change: 1.56 },
  { symbol: 'AVAX', price: 35.42, change: -2.31 },
  { symbol: 'DOT', price: 6.89, change: 4.12 },
  { symbol: 'LINK', price: 14.73, change: 1.87 },
  { symbol: 'UNI', price: 8.94, change: -0.45 },
];

function formatPrice(price: number): string {
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TickerChip({ item }: { item: TickerItem }) {
  const isPositive = item.change >= 0;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1">
      <span className="text-xs font-semibold text-white">{item.symbol}</span>
      <span className="text-xs text-neutral-400">
        ${formatPrice(item.price)}
      </span>
      <span
        className={`text-xs font-medium ${isPositive ? 'text-success' : 'text-error'}`}
      >
        {isPositive ? '↑' : '↓'}
        {isPositive ? '+' : ''}
        {item.change.toFixed(2)}%
      </span>
    </span>
  );
}

export function Ticker() {
  /* Triple items for seamless infinite scroll */
  const items = [...MOCK_TICKERS, ...MOCK_TICKERS, ...MOCK_TICKERS];

  return (
    <div className="relative overflow-hidden border-b border-border/30 bg-background-secondary/80">
      {/* Left fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background-secondary/80 to-transparent" />
      {/* Right fade */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background-secondary/80 to-transparent" />

      <div className="ticker-scroll flex whitespace-nowrap">
        {items.map((item, index) => (
          <TickerChip key={`${item.symbol}-${String(index)}`} item={item} />
        ))}
      </div>
    </div>
  );
}
