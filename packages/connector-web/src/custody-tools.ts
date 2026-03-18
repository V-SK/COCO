import type { CocoContext, CocoTool, ToolResult } from '@coco/core';
import { z } from 'zod';
import type { ChatStore } from './chat-store.js';

export function createCustodyTools(store: ChatStore): CocoTool[] {
  const createWalletTool: CocoTool = {
    id: 'custody.create-wallet',
    description: 'Create a new BSC custody wallet for the current user session. The private key is encrypted and stored server-side. Returns the wallet address.',
    schema: z.object({}),
    async execute(ctx: CocoContext): Promise<ToolResult> {
      const result = store.createWallet(ctx.sessionId);
      if (result.isNew) {
        return {
          success: true,
          data: { address: result.address },
          text: `Wallet created! Address: ${result.address}`,
        };
      }
      return {
        success: true,
        data: { address: result.address },
        text: `You already have a wallet: ${result.address}`,
      };
    },
  };

  const getAddressTool: CocoTool = {
    id: 'custody.get-address',
    description: 'Get the custody wallet address for the current user session.',
    schema: z.object({}),
    async execute(ctx: CocoContext): Promise<ToolResult> {
      const address = store.getWalletAddress(ctx.sessionId);
      if (!address) {
        return {
          success: true,
          data: { address: null },
          text: 'No wallet found. Use custody.create-wallet to create one.',
        };
      }
      return {
        success: true,
        data: { address },
        text: `Your wallet address: ${address}`,
      };
    },
  };

  const exportKeyTool: CocoTool = {
    id: 'custody.export-key',
    description: 'Export the private key of the custody wallet. WARNING: Share this securely with the user. Once exported, the user is responsible for their key.',
    schema: z.object({}),
    async execute(ctx: CocoContext): Promise<ToolResult> {
      const privateKey = store.exportPrivateKey(ctx.sessionId);
      if (!privateKey) {
        return {
          success: false,
          error: 'No wallet found for this session.',
          code: 'no_wallet',
        };
      }
      return {
        success: true,
        data: { privateKey },
        text: `⚠️ Your private key: ${privateKey}\n\nPlease save this securely. Anyone with this key can access your funds.`,
      };
    },
  };

  return [createWalletTool, getAddressTool, exportKeyTool];
}
