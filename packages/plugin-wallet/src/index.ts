import type { CocoPlugin } from '@coco/core';
import { WalletService } from './provider.js';
import { getBalanceTool } from './tools/get-balance.js';
import { transferTool } from './tools/transfer.js';

export let walletService = new WalletService(
  'https://bsc-dataseed.binance.org',
);

export function setWalletService(service: WalletService): void {
  walletService = service;
}

export const walletPlugin: CocoPlugin = {
  id: 'wallet',
  name: 'Coco Wallet',
  version: '1.0.0',
  description: 'Wallet balance and transfer support',
  async setup(runtime) {
    setWalletService(new WalletService(runtime.config.chain.rpcUrl));
  },
  tools: [getBalanceTool, transferTool],
};

export default walletPlugin;
