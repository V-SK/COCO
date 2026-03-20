import type { CocoPlugin, CocoTool } from '@coco/core';
import { z } from 'zod';

export interface DexAggConfig {
  providers: Array<'1inch' | 'paraswap' | 'openocean'>;
  chainId: number;
  apiKeys?:
    | {
        '1inch'?: string | undefined;
        paraswap?: string | undefined;
      }
    | undefined;
  defaultSlippage?: number | undefined;
}

export interface Quote {
  provider: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  gasEstimate: string;
  route: string[];
  tx?: Record<string, unknown> | undefined;
}

/**
 * Convert a human-readable amount to wei (raw units).
 * Assumes 18 decimals for ERC-20 tokens on BSC.
 */
function toWei(amount: string, decimals = 18): string {
  const parts = amount.split('.');
  const whole = parts[0] ?? '0';
  let frac = (parts[1] ?? '').slice(0, decimals).padEnd(decimals, '0');
  return BigInt(whole + frac).toString();
}

/**
 * Check if amount looks like it's already in wei (very large number).
 */
function isWei(amount: string): boolean {
  return amount.length > 10 && /^\d+$/.test(amount);
}

async function fetchQuote(
  provider: 'paraswap' | 'openocean',
  chainId: number,
  fromToken: string,
  toToken: string,
  amount: string,
): Promise<Quote> {
  // API expects wei — convert if amount looks human-readable
  const amountWei = isWei(amount) ? amount : toWei(amount);

  if (provider === 'paraswap') {
    const response = await fetch(
      `https://apiv5.paraswap.io/prices/?srcToken=${fromToken}&destToken=${toToken}&amount=${amountWei}&network=${chainId}&side=SELL`,
    );
    if (response.ok) {
      const payload = (await response.json()) as {
        priceRoute?: {
          destAmount?: string;
          gasCost?: string;
          bestRoute?: Array<{
            swaps?: Array<{ swapExchanges?: Array<{ exchange?: string }> }>;
          }>;
        };
      };
      return {
        provider,
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: payload.priceRoute?.destAmount ?? '0',
        priceImpact: 0,
        gasEstimate: payload.priceRoute?.gasCost ?? '0',
        route:
          payload.priceRoute?.bestRoute?.flatMap(
            (item) =>
              item.swaps?.flatMap(
                (swap) =>
                  swap.swapExchanges?.map(
                    (exchange) => exchange.exchange ?? 'unknown',
                  ) ?? [],
              ) ?? [],
          ) ?? [],
      };
    }
  }

  const response = await fetch(
    `https://open-api.openocean.finance/v3/${chainId}/quote?inTokenAddress=${fromToken}&outTokenAddress=${toToken}&amount=${amountWei}`,
  );
  if (!response.ok) {
    return {
      provider,
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: '0',
      priceImpact: 0,
      gasEstimate: '0',
      route: [],
    };
  }

  const payload = (await response.json()) as {
    data?: { outAmount?: string; estimatedGas?: string };
  };
  return {
    provider,
    fromToken,
    toToken,
    fromAmount: amount,
    toAmount: payload.data?.outAmount ?? '0',
    priceImpact: 0,
    gasEstimate: payload.data?.estimatedGas ?? '0',
    route: ['openocean'],
  };
}

export function createDexAggPlugin(
  config: DexAggConfig = {
    providers: ['paraswap', 'openocean'],
    chainId: 56,
    defaultSlippage: 300,
  },
): CocoPlugin {
  const quoteSchema = z.object({
    fromToken: z.string(),
    toToken: z.string(),
    amount: z.string(),
    slippage: z.number().optional(),
  });
  const compareSchema = quoteSchema;
  const executeSchema = quoteSchema.extend({
    preferProvider: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'dex-agg.get-best-quote',
      triggers: ['dex', 'quote', 'best'],
      description: 'Get the best available DEX quote.',
      schema: quoteSchema,
      async execute(_ctx, params: z.infer<typeof quoteSchema>) {
        const activeProviders = config.providers.filter(
          (provider): provider is 'paraswap' | 'openocean' =>
            provider === 'paraswap' || provider === 'openocean',
        );
        const quotes = await Promise.all(
          activeProviders.map((provider) =>
            fetchQuote(
              provider,
              config.chainId,
              params.fromToken,
              params.toToken,
              params.amount,
            ),
          ),
        );
        const best = quotes.sort(
          (left, right) => Number(right.toAmount) - Number(left.toAmount),
        )[0];
        return { success: true, data: best };
      },
    },
    {
      id: 'dex-agg.compare-quotes',
      triggers: ['dex', 'compare', 'quotes'],
      description: 'Compare all available DEX quotes.',
      schema: compareSchema,
      async execute(_ctx, params: z.infer<typeof compareSchema>) {
        const quotes = await Promise.all(
          config.providers
            .filter(
              (provider): provider is 'paraswap' | 'openocean' =>
                provider === 'paraswap' || provider === 'openocean',
            )
            .map((provider) =>
              fetchQuote(
                provider,
                config.chainId,
                params.fromToken,
                params.toToken,
                params.amount,
              ),
            ),
        );
        return { success: true, data: quotes };
      },
    },
    {
      id: 'dex-agg.execute-swap',
      triggers: ['dex', 'execute', 'swap'],
      description:
        'Execute the best DEX quote through the shared wallet executor.',
      schema: executeSchema,
      requiresConfirmation: true,
      async execute(ctx, params: z.infer<typeof executeSchema>) {
        const quotes = await Promise.all(
          config.providers
            .filter(
              (provider): provider is 'paraswap' | 'openocean' =>
                provider === 'paraswap' || provider === 'openocean',
            )
            .map((provider) =>
              fetchQuote(
                provider,
                config.chainId,
                params.fromToken,
                params.toToken,
                params.amount,
              ),
            ),
        );
        const preferred: Quote | undefined = params.preferProvider
          ? quotes.find((quote) => quote.provider === params.preferProvider)
          : undefined;
        const quote =
          preferred ??
          quotes.sort(
            (left, right) => Number(right.toAmount) - Number(left.toAmount),
          )[0];
        if (!quote) {
          return {
            success: false,
            error: 'No DEX quote providers are available.',
            code: 'dex_quote_unavailable',
          };
        }
        return await ctx.runtime.executeTransaction({
          operation: 'swap',
          toolId: 'dex-agg.execute-swap',
          ctx,
          tx: quote.tx ?? {
            to: '0x0000000000000000000000000000000000000000',
            data: '0x',
          },
          amountUsd: Number(params.amount),
          description: `Execute DEX aggregated swap via ${quote.provider}`,
        });
      },
    },
  ];

  return {
    id: 'dex-agg',
    name: 'Coco DEX Aggregator',
    version: '1.2.0',
    description: 'ParaSwap and OpenOcean quote aggregation',
    async setup() {},
    tools,
  };
}

export const dexAggPlugin = createDexAggPlugin();

export default dexAggPlugin;
