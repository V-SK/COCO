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

/* Try .us first (US users), fallback to .com */
const REST_URLS = [
  'https://api.binance.us/api/v3/ticker/24hr',
  'https://api.binance.com/api/v3/ticker/24hr',
];
const WS_URLS = [
  'wss://stream.binance.us:9443/stream',
  'wss://stream.binance.com:9443/stream',
];

function parseTickers(data: Array<Record<string, string>>): TickerData[] {
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
  mapped.sort((a, b) => {
    const ai = SYMBOLS.findIndex((s) => s.symbol === a.symbol);
    const bi = SYMBOLS.findIndex((s) => s.symbol === b.symbol);
    return ai - bi;
  });
  return mapped;
}

export function useBinanceTickers() {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wsIndexRef = useRef(0);

  useEffect(() => {
    // REST: try endpoints in order
    async function fetchRest() {
      for (const url of REST_URLS) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          const parsed = parseTickers(data);
          if (parsed.length > 0) {
            setTickers(parsed);
            return;
          }
        } catch { /* try next */ }
      }
    }
    void fetchRest();

    // WebSocket: try endpoints with fallback
    function connect() {
      const streams = PAIRS.map((p) => `${p}@miniTicker`).join('/');
      const url = `${WS_URLS[wsIndexRef.current]}?streams=${streams}`;
      const ws = new WebSocket(url);

      const openTimer = setTimeout(() => {
        // If not connected after 5s, try next endpoint
        ws.close();
      }, 5000);

      ws.onopen = () => {
        clearTimeout(openTimer);
        setConnected(true);
      };

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
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        clearTimeout(openTimer);
        setConnected(false);
        wsRef.current = null;
        // Try next endpoint on reconnect
        wsIndexRef.current = (wsIndexRef.current + 1) % WS_URLS.length;
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
