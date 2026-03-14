import { CocoError, estimateUsdValue } from '@coco/core';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  parseUnits,
} from 'ethers';
import {
  PANCAKE_ROUTER,
  type TokenInfo,
  WBNB,
  resolveToken,
} from './tokens.js';

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
] as const;

function serializeTx(tx: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(tx, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Record<string, unknown>;
}

function buildPath(tokenIn: TokenInfo, tokenOut: TokenInfo): string[] {
  if (tokenIn.address === tokenOut.address) {
    throw new CocoError(
      'tokenIn and tokenOut must be different.',
      'swap_same_token',
    );
  }
  if (tokenIn.address === WBNB || tokenOut.address === WBNB) {
    return [tokenIn.address, tokenOut.address];
  }

  return [tokenIn.address, WBNB, tokenOut.address];
}

export interface SwapQuote {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  path: string[];
  unsignedTx: Record<string, unknown>;
  amountUsd?: number | undefined;
}

export class PancakeSwapService {
  readonly #provider: JsonRpcProvider;
  readonly #router: Contract;
  readonly #iface: Interface;

  constructor(rpcUrl: string) {
    this.#provider = new JsonRpcProvider(rpcUrl);
    this.#router = new Contract(PANCAKE_ROUTER, ROUTER_ABI, this.#provider);
    this.#iface = new Interface(ROUTER_ABI);
  }

  async init(): Promise<void> {}

  async getQuote(
    tokenInInput: string,
    tokenOutInput: string,
    amountIn: string,
    slippageBps: number,
    recipient: string,
  ): Promise<SwapQuote> {
    const tokenIn = resolveToken(tokenInInput);
    const tokenOut = resolveToken(tokenOutInput);
    const path = buildPath(tokenIn, tokenOut);
    const amountInWei = parseUnits(amountIn, tokenIn.decimals);
    const getAmountsOut = this.#router.getFunction('getAmountsOut');
    const amounts = (await getAmountsOut(amountInWei, path)) as bigint[];
    const amountOutWei = amounts.at(-1);
    if (amountOutWei == null) {
      throw new CocoError(
        'PancakeSwap did not return a quote.',
        'swap_quote_unavailable',
      );
    }
    const amountOutMinWei =
      (amountOutWei * BigInt(10_000 - slippageBps)) / 10_000n;
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
    const amountOut = formatUnits(amountOutWei, tokenOut.decimals);
    const amountOutMin = formatUnits(amountOutMinWei, tokenOut.decimals);

    let tx: Record<string, unknown>;
    if (tokenIn.isNative) {
      tx = {
        to: PANCAKE_ROUTER,
        data: this.#iface.encodeFunctionData('swapExactETHForTokens', [
          amountOutMinWei,
          path,
          recipient,
          deadline,
        ]),
        value: amountInWei.toString(),
      };
    } else if (tokenOut.isNative) {
      tx = {
        to: PANCAKE_ROUTER,
        data: this.#iface.encodeFunctionData('swapExactTokensForETH', [
          amountInWei,
          amountOutMinWei,
          path,
          recipient,
          deadline,
        ]),
        value: '0',
      };
    } else {
      tx = {
        to: PANCAKE_ROUTER,
        data: this.#iface.encodeFunctionData('swapExactTokensForTokens', [
          amountInWei,
          amountOutMinWei,
          path,
          recipient,
          deadline,
        ]),
        value: '0',
      };
    }

    return {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      amountOutMin,
      path,
      unsignedTx: serializeTx(tx),
      amountUsd: tokenIn.priceSymbol
        ? await estimateUsdValue(tokenIn.priceSymbol, amountIn)
        : undefined,
    };
  }
}
