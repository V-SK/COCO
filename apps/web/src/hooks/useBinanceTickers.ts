import { useEffect, useRef, useState } from 'react';

export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  marketCap?: number;
}

const SYMBOLS = [
  { symbol: 'BTC', pair: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETH', pair: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'BNB', pair: 'BNBUSDT', name: 'BNB' },
  { symbol: 'SOL', pair: 'SOLUSDT', name: 'Solana' },
  { symbol: 'DOGE', pair: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'ADA', pair: 'ADAUSDT', name: 'Cardano' },
  { symbol: 'AVAX', pair: 'AVAXUSDT', name: 'Avalanche' },
  { symbol: 'DOT', pair: 'DOTUSDT', name: 'Polkadot' },
  { symbol: 'LINK', pair: 'LINKUSDT', name: 'Chainlink' },
  { symbol: 'UNI', pair: 'UNIUSDT', name: 'Uniswap' },
];

const PAIRS = SYMBOLS.map((s) => s.pair.toLowerCase());

export function useBinanceTickers() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Initial REST fetch
    fetch('https://api.binance.com/api/v3/ticker/24hr')
      .then((r) => r.json())
      .then((data: Array<Record<string, string>>) => {
        const pairSet = new Set(SYMBOLS.map((s) => s.pair));
        const filtered = data.filter((d) => pairSet.has(d.symbol));
        const mapped = filtered.map((d) => {
          const meta = SYMBOLS.find((s) => s.pair === d.symbol)!;
          return {
            symbol: meta.symbol,
            name: meta.name,
            price: parseFloat(d.lastPrice),
            change24h: parseFloat(d.priceChangePercent),
            volume24h: parseFloat(d.quoteVolume),
            high24h: parseFloat(d.highPrice),
            low24h: parseFloat(d.lowPrice),
          };
        });
        // Sort by SYMBOLS order
        mapped.sort((a, b) => {
          const ai = SYMBOLS.findIndex((s) => s.symbol === a.symbol);
          const bi = SYMBOLS.findIndex((s) => s.symbol === b.symbol);
          return ai - bi;
        });
        setTickers(mapped);
      })
      .catch(() => {});

    // WebSocket for real-time updates
    function connect() {
      const streams = PAIRS.map((p) => `${p}@miniTicker`).join('/');
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/stream?streams=${streams}`,
      );

      ws.onopen = () => setConnected(true);

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data;
          if (!d?.s) return;
          const meta = SYMBOLS.find((s) => s.pair === d.s);
          if (!meta) return;

          setTickers((prev) => {
            const idx = prev.findIndex((t) => t.symbol === meta.symbol);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              price: parseFloat(d.c),
              change24h:
                ((parseFloat(d.c) - parseFloat(d.o)) / parseFloat(d.o)) * 100,
              volume24h: parseFloat(d.q),
              high24h: parseFloat(d.h),
              low24h: parseFloat(d.l),
            };
            return next;
          });
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }

    connect();

    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { tickers, connected };
}
