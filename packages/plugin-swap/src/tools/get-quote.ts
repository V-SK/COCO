import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { pancakeswap } from '../index.js';

const GetQuoteSchema = z.object({
  tokenIn: z.string().describe('Input token symbol or address'),
  tokenOut: z.string().describe('Output token symbol or address'),
  amountIn: z.string().describe('Input token amount'),
  slippageBps: z.number().optional().default(300),
});

type GetQuoteParams = z.infer<typeof GetQuoteSchema>;

export const getQuoteTool: CocoTool<GetQuoteParams> = {
  id: 'swap.quote',
  triggers: ['quote', 'swap', 'price impact', '报价'],
  description: 'Get a PancakeSwap quote without executing the transaction.',
  schema: GetQuoteSchema,
  async execute(ctx, params): Promise<ToolResult> {
    const recipient = await ctx.runtime.getExecutionAddress(ctx);
    if (!recipient) {
      return {
        success: false,
        error: 'Wallet address is required to build a swap quote.',
        code: 'wallet_address_missing',
      };
    }

    const quote = await pancakeswap.getQuote(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.slippageBps,
      recipient,
    );

    return {
      success: true,
      data: quote,
      text: `预计可将 ${params.amountIn} ${quote.tokenIn.symbol} 换成约 ${quote.amountOut} ${quote.tokenOut.symbol}。`,
    };
  },
};
