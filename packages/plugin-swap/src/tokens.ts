import { CocoError } from '@coco/core';
import { isAddress } from 'ethers';

export const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export const TOKENS: Record<
  string,
  {
    address: string;
    decimals: number;
    symbol: string;
    isStable?: boolean;
    binanceSymbol?: string;
  }
> = {
  BNB: { address: WBNB, decimals: 18, symbol: 'BNB', binanceSymbol: 'BNB' },
  WBNB: { address: WBNB, decimals: 18, symbol: 'WBNB', binanceSymbol: 'BNB' },
  USDT: {
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    symbol: 'USDT',
    isStable: true,
  },
  USDC: {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    symbol: 'USDC',
    isStable: true,
  },
  BUSD: {
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
    symbol: 'BUSD',
    isStable: true,
  },
  CAKE: {
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    decimals: 18,
    symbol: 'CAKE',
    binanceSymbol: 'CAKE',
  },
};

export interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
  priceSymbol?: string;
}

export function resolveToken(input: string): TokenInfo {
  const normalized = input.trim().toUpperCase();
  const known = TOKENS[normalized];
  if (known) {
    return {
      symbol: known.symbol,
      address: known.address,
      decimals: known.decimals,
      isNative: normalized === 'BNB',
      priceSymbol: known.binanceSymbol ?? known.symbol,
    };
  }

  if (isAddress(input)) {
    return {
      symbol: input,
      address: input,
      decimals: 18,
      isNative: false,
    };
  }

  throw new CocoError(`Unknown token ${input}.`, 'unknown_token');
}
