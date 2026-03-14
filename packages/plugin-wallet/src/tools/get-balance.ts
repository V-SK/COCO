import type { CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import { walletService } from '../index.js';

const GetBalanceSchema = z.object({
  token: z
    .string()
    .describe('Token symbol or contract address, e.g. BNB, USDT'),
  address: z
    .string()
    .optional()
    .describe('Wallet address; defaults to current wallet'),
});

type GetBalanceParams = z.infer<typeof GetBalanceSchema>;

export const getBalanceTool: CocoTool<GetBalanceParams> = {
  id: 'wallet.get-balance',
  triggers: ['balance', 'wallet', '余额'],
  description: 'Get the balance of a token in a wallet on BNB Chain.',
  schema: GetBalanceSchema,
  async execute(ctx, params): Promise<ToolResult> {
    const address = params.address ?? ctx.walletAddress;
    if (!address) {
      return {
        success: false,
        error: 'Wallet address is required to query balances.',
        code: 'wallet_address_missing',
      };
    }

    const balance = await walletService.getBalance(address, params.token);
    return {
      success: true,
      data: balance,
      text: `${address} 的 ${balance.token.symbol} 余额约为 ${balance.balance}。`,
    };
  },
};
