import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { walletService } from '../index.js';

const TransferSchema = z.object({
  token: z.string().describe('Token symbol or contract address'),
  to: z.string().describe('Recipient address'),
  amount: z.string().describe('Transfer amount'),
});

type TransferParams = z.infer<typeof TransferSchema>;

export const transferTool: CocoTool<TransferParams> = {
  id: 'wallet.transfer',
  triggers: ['transfer', 'send', '转账'],
  description: 'Transfer native token or ERC20 asset.',
  schema: TransferSchema,
  requiresConfirmation: true,
  async execute(ctx, params): Promise<ToolResult> {
    const prepared = await walletService.buildTransferTx(
      params.token,
      params.to,
      params.amount,
    );

    const result = await ctx.runtime.executeTransaction({
      operation: 'transfer',
      toolId: 'wallet.transfer',
      ctx,
      tx: prepared.tx,
      amountUsd: prepared.amountUsd,
      description: `Transfer ${params.amount} ${prepared.token.symbol} to ${params.to}`,
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      text:
        result.data && typeof result.data === 'object' && 'type' in result.data
          ? result.data.type === 'unsigned_tx'
            ? `已生成 ${params.amount} ${prepared.token.symbol} 的未签名转账交易。`
            : `已广播 ${params.amount} ${prepared.token.symbol} 的转账交易。`
          : result.text,
      data: {
        token: prepared.token,
        ...(result.data as Record<string, unknown>),
      },
    };
  },
};
