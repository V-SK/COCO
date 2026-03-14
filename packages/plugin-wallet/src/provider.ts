import { CocoError, estimateUsdValue } from '@coco/core';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  isAddress,
  parseUnits,
} from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

const TOKEN_MAP: Record<
  string,
  { address: string; decimals: number; symbol: string; priceSymbol?: string }
> = {
  BNB: {
    address: 'native',
    decimals: 18,
    symbol: 'BNB',
    priceSymbol: 'BNB',
  },
  USDT: {
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    symbol: 'USDT',
    priceSymbol: 'USDT',
  },
  USDC: {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    symbol: 'USDC',
    priceSymbol: 'USDC',
  },
  BUSD: {
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
    symbol: 'BUSD',
    priceSymbol: 'BUSD',
  },
  CAKE: {
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    decimals: 18,
    symbol: 'CAKE',
    priceSymbol: 'CAKE',
  },
};

function serializeTx(tx: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(tx, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Record<string, unknown>;
}

export interface WalletToken {
  symbol: string;
  address: string;
  decimals: number;
  isNative: boolean;
  priceSymbol?: string | undefined;
}

export function resolveWalletToken(input: string): WalletToken {
  const normalized = input.trim().toUpperCase();
  const known = TOKEN_MAP[normalized];
  if (known) {
    return {
      symbol: known.symbol,
      address: known.address,
      decimals: known.decimals,
      isNative: known.address === 'native',
      priceSymbol: known.priceSymbol,
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

export class WalletService {
  readonly #provider: JsonRpcProvider;
  readonly #iface: Interface;

  constructor(rpcUrl: string) {
    this.#provider = new JsonRpcProvider(rpcUrl);
    this.#iface = new Interface(ERC20_ABI);
  }

  async getBalance(address: string, tokenInput: string) {
    if (!isAddress(address)) {
      throw new CocoError(
        'Wallet address is invalid.',
        'invalid_wallet_address',
      );
    }

    const token = resolveWalletToken(tokenInput);
    if (token.isNative) {
      const balance = await this.#provider.getBalance(address);
      return {
        token,
        balance: formatUnits(balance, token.decimals),
      };
    }

    const contract = new Contract(token.address, ERC20_ABI, this.#provider);
    const balanceOf = contract.getFunction('balanceOf');
    const balance = (await balanceOf(address)) as bigint;
    return {
      token,
      balance: formatUnits(balance, token.decimals),
    };
  }

  async buildTransferTx(tokenInput: string, to: string, amount: string) {
    if (!isAddress(to)) {
      throw new CocoError('Recipient address is invalid.', 'invalid_recipient');
    }

    const token = resolveWalletToken(tokenInput);
    if (token.isNative) {
      return {
        token,
        tx: serializeTx({
          to,
          value: parseUnits(amount, token.decimals).toString(),
        }),
        amountUsd: token.priceSymbol
          ? await estimateUsdValue(token.priceSymbol, amount)
          : undefined,
      };
    }

    const encodedAmount = parseUnits(amount, token.decimals);
    return {
      token,
      tx: serializeTx({
        to: token.address,
        value: '0',
        data: this.#iface.encodeFunctionData('transfer', [to, encodedAmount]),
      }),
      amountUsd: token.priceSymbol
        ? await estimateUsdValue(token.priceSymbol, amount)
        : undefined,
    };
  }
}
