import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { dexService } from '../index.js';

const DexTokenSchema = z.object({
  address: z.string().describe('Token contract address (0x...)'),
  chain: z.string().optional().describe('Chain id, default bsc'),
});

type DexTokenParams = z.infer<typeof DexTokenSchema>;

export const dexTokenTool: CocoTool<DexTokenParams> = {
  id: 'dex.token-info',
  triggers: ['dex', 'dexscreener', 'token-info', '代币信息'],
  description:
    'Get detailed DEX trading data for a token: price, liquidity, volume, buy/sell pressure, FDV, market cap, pair age.',
  schema: DexTokenSchema,
  async execute(_ctx, params): Promise<ToolResult> {
    try {
      const data = await dexService.getTokenByAddress(
        params.address,
        params.chain ?? 'bsc',
      );

      const ageMs = Date.now() - data.pairCreatedAt;
      const ageDays = Math.floor(ageMs / 86_400_000);
      const ageHours = Math.floor((ageMs % 86_400_000) / 3_600_000);
      const ageStr =
        ageDays > 0 ? `${ageDays}天${ageHours}小时` : `${ageHours}小时`;

      const buySellRatio24h =
        data.buys24h + data.sells24h > 0
          ? ((data.buys24h / (data.buys24h + data.sells24h)) * 100).toFixed(1)
          : 'N/A';
      const buySellRatio1h =
        data.buys1h + data.sells1h > 0
          ? ((data.buys1h / (data.buys1h + data.sells1h)) * 100).toFixed(1)
          : 'N/A';

      return {
        success: true,
        data: {
          ...data,
          ageStr,
          buySellRatio24h,
          buySellRatio1h,
          totalTxns24h: data.buys24h + data.sells24h,
          totalTxns1h: data.buys1h + data.sells1h,
        },
        text: [
          `${data.name} (${data.symbol})`,
          `价格: $${data.priceUsd < 0.01 ? data.priceUsd.toFixed(10) : data.priceUsd.toFixed(4)}`,
          `24h: ${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}% | 1h: ${data.change1h >= 0 ? '+' : ''}${data.change1h.toFixed(2)}% | 5m: ${data.change5m >= 0 ? '+' : ''}${data.change5m.toFixed(2)}%`,
          `流动性: $${(data.liquidityUsd / 1000).toFixed(1)}K | 24h交易量: $${(data.volume24h / 1000).toFixed(1)}K`,
          `24h买/卖: ${data.buys24h}/${data.sells24h} (买入占比${buySellRatio24h}%) | 1h: ${data.buys1h}/${data.sells1h}`,
          `FDV: $${(data.fdv / 1000).toFixed(1)}K | 市值: $${(data.marketCap / 1000).toFixed(1)}K`,
          `交易对创建: ${ageStr}前 | DEX: ${data.dex}`,
        ].join('\n'),
      };
    } catch (err) {
      return {
        success: false,
        error: `无法获取 ${params.address} 的 DEX 数据: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
