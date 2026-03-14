import { CocoError } from '../errors.js';

const STABLES = new Set(['USDT', 'USDC', 'BUSD']);
const BINANCE_PAIRS: Record<string, string> = {
  BNB: 'BNBUSDT',
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  CAKE: 'CAKEUSDT',
};

export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function estimateUsdValue(
  symbol: string,
  amount: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<number | undefined> {
  const normalized = normalizeSymbol(symbol);
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) {
    throw new CocoError('Amount must be numeric.', 'invalid_amount');
  }

  if (STABLES.has(normalized)) {
    return parsedAmount;
  }

  const pair = BINANCE_PAIRS[normalized];
  if (!pair) {
    return undefined;
  }

  const response = await fetchImpl(
    `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
  );
  if (!response.ok) {
    throw new CocoError(
      `Binance price lookup failed for ${normalized}.`,
      'market_price_lookup_failed',
    );
  }

  const json = (await response.json()) as { price?: string };
  const price = Number(json.price);
  if (!Number.isFinite(price)) {
    return undefined;
  }

  return price * parsedAmount;
}
