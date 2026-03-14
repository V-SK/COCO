import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { pancakeswap } from '../index.js';

const ExecuteSwapSchema = z.object({
  tokenIn: z.string().describe('Input token symbol or address'),
  tokenOut: z.string().describe('Output token symbol or address'),
  amountIn: z.string().describe('Input token amount'),
  slippageBps: z.number().optional().default(300),
});

type ExecuteSwapParams = z.infer<typeof ExecuteSwapSchema>;

export const executeSwapTool: CocoTool<ExecuteSwapParams> = {
  id: 'swap.execute',
  triggers: ['swap', 'exchange', 'trade', 'convert', '换', '兑换', '交易'],
  description:
    'Execute a PancakeSwap trade. Depending on wallet mode this returns unsigned tx or tx hash.',
  schema: ExecuteSwapSchema,
  requiresConfirmation: true,
  async validate(ctx) {
    const executionAddress = await ctx.runtime.getExecutionAddress(ctx);
    return Boolean(executionAddress);
  },
  async execute(ctx, params): Promise<ToolResult> {
    const executionAddress = await ctx.runtime.getExecutionAddress(ctx);
    if (!executionAddress) {
      return {
        success: false,
        error: 'Wallet address is required to execute a swap.',
        code: 'wallet_address_missing',
      };
    }

    const quote = await pancakeswap.getQuote(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.slippageBps,
      executionAddress,
    );

    const result = await ctx.runtime.executeTransaction({
      operation: 'swap',
      toolId: 'swap.execute',
      ctx,
      tx: quote.unsignedTx,
      amountUsd: quote.amountUsd,
      description: `Swap ${params.amountIn} ${quote.tokenIn.symbol} to ${quote.tokenOut.symbol}`,
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      text:
        result.data && typeof result.data === 'object' && 'type' in result.data
          ? result.data.type === 'unsigned_tx'
            ? `准备将 ${params.amountIn} ${quote.tokenIn.symbol} 换成约 ${quote.amountOut} ${quote.tokenOut.symbol}。`
            : `Swap 已广播，预计输出约 ${quote.amountOut} ${quote.tokenOut.symbol}。`
          : result.text,
      data: {
        quote,
        ...(result.data as Record<string, unknown>),
      },
    };
  },
};
