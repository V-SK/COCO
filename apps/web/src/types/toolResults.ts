export interface PriceResultLike {
  symbol: string;
  price: number;
  change24h?: number | null | undefined;
  changePercent24h?: number | null | undefined;
  high24h?: number | null | undefined;
  low24h?: number | null | undefined;
}

export interface ScanResultLike {
  address: string;
  trustScore: number;
  risks: string[];
  raw?: Record<string, unknown> | undefined;
}

export interface TokenLike {
  symbol: string;
  address?: string | undefined;
}

export interface UnsignedTxLike {
  to: string;
  data?: string | undefined;
  value?: string | undefined;
}

export interface SwapQuoteLike {
  tokenIn: TokenLike;
  tokenOut: TokenLike;
  amountIn: string;
  amountOut: string;
  amountOutMin?: string | undefined;
  slippageBps?: number | null | undefined;
  priceImpact?: number | null | undefined;
  unsignedTx?: UnsignedTxLike | undefined;
}

export interface SwapExecuteResultLike {
  type: 'unsigned_tx';
  tx: UnsignedTxLike;
  quote: SwapQuoteLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPriceResultLike(value: unknown): value is PriceResultLike {
  return (
    isRecord(value) &&
    typeof value.symbol === 'string' &&
    typeof value.price === 'number'
  );
}

export function isScanResultLike(value: unknown): value is ScanResultLike {
  return (
    isRecord(value) &&
    typeof value.address === 'string' &&
    typeof value.trustScore === 'number' &&
    Array.isArray(value.risks)
  );
}

export function isUnsignedTxLike(value: unknown): value is UnsignedTxLike {
  return isRecord(value) && typeof value.to === 'string';
}

export function isSwapQuoteLike(value: unknown): value is SwapQuoteLike {
  return (
    isRecord(value) &&
    isRecord(value.tokenIn) &&
    typeof value.tokenIn.symbol === 'string' &&
    isRecord(value.tokenOut) &&
    typeof value.tokenOut.symbol === 'string' &&
    typeof value.amountIn === 'string' &&
    typeof value.amountOut === 'string'
  );
}

export function isSwapExecuteResultLike(
  value: unknown,
): value is SwapExecuteResultLike {
  return (
    isRecord(value) &&
    value.type === 'unsigned_tx' &&
    isUnsignedTxLike(value.tx) &&
    isSwapQuoteLike(value.quote)
  );
}
