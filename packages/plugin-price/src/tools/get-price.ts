import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { priceService, dexService } from '../index.js';

const GetPriceSchema = z.object({
  symbol: z
    .string()
    .describe(
      'Token symbol (e.g. BTC, ETH, BNB) or contract address (0x...)',
    ),
});

type GetPriceParams = z.infer<typeof GetPriceSchema>;

function isContractAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

function fmt(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(10);
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export const getPriceTool: CocoTool<GetPriceParams> = {
  id: 'price.get',
  triggers: ['price', 'quote', '行情', '价格', '查价'],
  description:
    'Get the latest market price for a token. Supports symbols (BTC, ETH) and contract addresses (0x...).',
  schema: GetPriceSchema,
  async execute(_ctx, params): Promise<ToolResult> {
    // Contract address → always use DexScreener
    if (isContractAddress(params.symbol)) {
      try {
        const dex = await dexService.getTokenByAddress(params.symbol);
        return {
          success: true,
          data: {
            source: 'dexscreener',
            symbol: dex.symbol,
            name: dex.name,
            address: dex.address,
            price: dex.priceUsd,
            change24h: dex.change24h,
            change1h: dex.change1h,
            change5m: dex.change5m,
            volume24h: dex.volume24h,
            volume1h: dex.volume1h,
            liquidityUsd: dex.liquidityUsd,
            fdv: dex.fdv,
            marketCap: dex.marketCap,
            buys24h: dex.buys24h,
            sells24h: dex.sells24h,
            buys1h: dex.buys1h,
            sells1h: dex.sells1h,
            dex: dex.dex,
            pairAddress: dex.pairAddress,
            pairCreatedAt: dex.pairCreatedAt,
          },
          text: `${dex.name} (${dex.symbol}) 价格 $${fmt(dex.priceUsd)}，24h ${dex.change24h >= 0 ? '+' : ''}${dex.change24h.toFixed(2)}%，流动性 ${fmtUsd(dex.liquidityUsd)}，24h交易量 ${fmtUsd(dex.volume24h)}。`,
        };
      } catch {
        return {
          success: false,
          error: `未找到合约 ${params.symbol} 的 DEX 交易对`,
        };
      }
    }

    // Symbol → try Binance first, fallback to DexScreener search
    try {
      const snapshot = await priceService.getSnapshot(params.symbol);
      const normalized = priceService.normalizeInput(params.symbol);
      return {
        success: true,
        data: {
          source: 'binance',
          symbol: normalized,
          price: snapshot.price,
          change24h: snapshot.changePercent24h,
          high24h: snapshot.high24h,
          low24h: snapshot.low24h,
        },
        text: `${normalized} 最新价格 $${fmt(snapshot.price)}，24h ${(snapshot.changePercent24h ?? 0) >= 0 ? '+' : ''}${(snapshot.changePercent24h ?? 0).toFixed(2)}%。`,
      };
    } catch {
      // Binance failed → try DexScreener search
      try {
        const results = await dexService.searchToken(params.symbol);
        if (results.length === 0) {
          return {
            success: false,
            error: `未找到 ${params.symbol} 的价格数据（Binance 和 DEX 均无结果）`,
          };
        }
        const top = results[0]!;
        return {
          success: true,
          data: {
            source: 'dexscreener',
            symbol: top.symbol,
            name: top.name,
            address: top.address,
            price: top.priceUsd,
            change24h: top.change24h,
            change1h: top.change1h,
            volume24h: top.volume24h,
            liquidityUsd: top.liquidityUsd,
            fdv: top.fdv,
            marketCap: top.marketCap,
            buys24h: top.buys24h,
            sells24h: top.sells24h,
            dex: top.dex,
          },
          text: `${top.name} (${top.symbol}) 价格 $${fmt(top.priceUsd)}，24h ${top.change24h >= 0 ? '+' : ''}${top.change24h.toFixed(2)}%，流动性 ${fmtUsd(top.liquidityUsd)}。`,
        };
      } catch {
        return {
          success: false,
          error: `未找到 ${params.symbol} 的价格数据`,
        };
      }
    }
  },
};
