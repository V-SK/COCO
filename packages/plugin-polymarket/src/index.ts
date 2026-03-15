import type { CocoPlugin, CocoTool } from '@coco/core';
import { z } from 'zod';

export interface PolymarketConfig {
  clobApiUrl?: string | undefined;
  clobApiKey?: string | undefined;
  privateKey?: string | undefined;
}

export interface PredictionMarket {
  id: string;
  question: string;
  description: string;
  category: 'politics' | 'crypto' | 'sports' | 'economics' | 'other';
  endDate: number;
  resolved: boolean;
  outcome?: string | undefined;
  tokens: {
    yes: { price: number; volume24h: string };
    no: { price: number; volume24h: string };
  };
  liquidity: string;
  volume: string;
}

async function fetchMarkets(limit = 10): Promise<PredictionMarket[]> {
  const response = await fetch(
    `https://gamma-api.polymarket.com/markets?limit=${limit}&closed=false`,
  );
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as Array<{
    id?: string | number;
    question?: string;
    description?: string;
    category?: string;
    endDate?: string;
    active?: boolean;
    volumeNum?: number;
    liquidityNum?: number;
    outcomes?: string[];
    outcomePrices?: string[];
  }>;
  return payload.map((item) => ({
    id: String(item.id ?? ''),
    question: item.question ?? 'Unknown market',
    description: item.description ?? '',
    category:
      item.category === 'politics' ||
      item.category === 'crypto' ||
      item.category === 'sports' ||
      item.category === 'economics'
        ? item.category
        : 'other',
    endDate: item.endDate ? Date.parse(item.endDate) : Date.now(),
    resolved: item.active === false,
    tokens: {
      yes: {
        price: Number(item.outcomePrices?.[0] ?? '0'),
        volume24h: String(item.volumeNum ?? 0),
      },
      no: {
        price: Number(item.outcomePrices?.[1] ?? '0'),
        volume24h: String(item.volumeNum ?? 0),
      },
    },
    liquidity: String(item.liquidityNum ?? 0),
    volume: String(item.volumeNum ?? 0),
  }));
}

export function createPolymarketPlugin(
  _config: PolymarketConfig = {},
): CocoPlugin {
  const listSchema = z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().optional(),
  });
  const getSchema = z.object({
    marketId: z.string(),
  });
  const pricesSchema = z.object({
    marketId: z.string(),
  });
  const placeSchema = z.object({
    marketId: z.string(),
    side: z.enum(['YES', 'NO']),
    type: z.enum(['MARKET', 'LIMIT']),
    size: z.number(),
    price: z.number().optional(),
  });
  const positionsSchema = z.object({
    address: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'polymarket.list-markets',
      triggers: ['polymarket', 'markets'],
      description: 'List open Polymarket markets.',
      schema: listSchema,
      async execute(_ctx, params: z.infer<typeof listSchema>) {
        const markets = await fetchMarkets(params.limit ?? 10);
        return {
          success: true,
          data: markets.filter(
            (market) =>
              (params.category ? market.category === params.category : true) &&
              (params.search
                ? market.question
                    .toLowerCase()
                    .includes(params.search.toLowerCase())
                : true),
          ),
        };
      },
    },
    {
      id: 'polymarket.get-market',
      triggers: ['polymarket', 'market', 'detail'],
      description: 'Get one market detail from Polymarket.',
      schema: getSchema,
      async execute(_ctx, params: z.infer<typeof getSchema>) {
        const markets = await fetchMarkets(50);
        const market = markets.find((entry) => entry.id === params.marketId);
        return market
          ? { success: true, data: market }
          : {
              success: false,
              error: 'Polymarket market not found.',
              code: 'polymarket_market_not_found',
            };
      },
    },
    {
      id: 'polymarket.get-prices',
      triggers: ['polymarket', 'prices'],
      description: 'Get YES/NO prices for a market.',
      schema: pricesSchema,
      async execute(_ctx, params: z.infer<typeof pricesSchema>) {
        const markets = await fetchMarkets(50);
        const market = markets.find((entry) => entry.id === params.marketId);
        return market
          ? {
              success: true,
              data: market.tokens,
            }
          : {
              success: false,
              error: 'Polymarket market not found.',
              code: 'polymarket_market_not_found',
            };
      },
    },
    {
      id: 'polymarket.place-order',
      triggers: ['polymarket', 'order'],
      description: 'Reserved order entrypoint; phase 3 stays read-only.',
      schema: placeSchema,
      async execute() {
        return {
          success: false,
          error: 'Polymarket trading is disabled in phase 3 read-only mode.',
          code: 'read_only_mode',
        };
      },
    },
    {
      id: 'polymarket.get-positions',
      triggers: ['polymarket', 'positions'],
      description: 'Return read-only context for Polymarket positions.',
      schema: positionsSchema,
      async execute(_ctx, params: z.infer<typeof positionsSchema>) {
        return {
          success: true,
          data: {
            address: params.address,
            positions: [],
            note: 'Phase 3 exposes Polymarket in read-only mode. Trading and account sync are not enabled.',
          },
        };
      },
    },
  ];

  return {
    id: 'polymarket',
    name: 'Coco Polymarket',
    version: '1.2.0',
    description: 'Read-only Polymarket market discovery and pricing',
    async setup() {},
    tools,
  };
}

export const polymarketPlugin = createPolymarketPlugin();

export default polymarketPlugin;
