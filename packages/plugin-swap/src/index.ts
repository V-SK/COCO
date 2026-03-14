import type { CocoPlugin } from '@coco/core';
import { PancakeSwapService } from './pancakeswap.js';
import { executeSwapTool } from './tools/execute-swap.js';
import { getQuoteTool } from './tools/get-quote.js';

export let pancakeswap = new PancakeSwapService(
  'https://bsc-dataseed.binance.org',
);

export function setPancakeSwapService(service: PancakeSwapService): void {
  pancakeswap = service;
}

export const swapPlugin: CocoPlugin = {
  id: 'swap',
  name: 'Coco Swap',
  version: '1.0.0',
  description: 'PancakeSwap V2 integration for BNB Chain',
  async setup(runtime) {
    setPancakeSwapService(new PancakeSwapService(runtime.config.chain.rpcUrl));
    await pancakeswap.init();
  },
  tools: [getQuoteTool, executeSwapTool],
};

export default swapPlugin;
