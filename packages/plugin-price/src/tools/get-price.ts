import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { priceService } from '../index.js';

const GetPriceSchema = z.object({
  symbol: z
    .string()
    .describe('Symbol or trading pair, e.g. BTC, ETH, BNB, BTCUSDT'),
});

type GetPriceParams = z.infer<typeof GetPriceSchema>;

export const getPriceTool: CocoTool<GetPriceParams> = {
  id: 'price.get',
  triggers: ['price', 'quote', '行情', '价格'],
  description: 'Get the latest market price for a token from Binance.',
  schema: GetPriceSchema,
  async execute(_ctx, params): Promise<ToolResult> {
    const snapshot = await priceService.getSnapshot(params.symbol);
    const normalized = priceService.normalizeInput(params.symbol);

    return {
      success: true,
      data: {
        symbol: normalized,
        price: snapshot.price,
        change24h: snapshot.change24h,
        changePercent24h: snapshot.changePercent24h,
        high24h: snapshot.high24h,
        low24h: snapshot.low24h,
      },
      text: `${normalized} 最新价格约为 $${snapshot.price.toFixed(4)}。`,
    };
  },
};
