import type { CocoPlugin } from '@coco/core';
import { BinancePriceService } from './binance.js';
import { DexScreenerService } from './dexscreener.js';
import { dexTokenTool } from './tools/dex-token.js';
import { getPriceTool } from './tools/get-price.js';

export let priceService = new BinancePriceService();
export let dexService = new DexScreenerService();

export function setPriceService(service: BinancePriceService): void {
  priceService = service;
}

export const pricePlugin: CocoPlugin = {
  id: 'price',
  name: 'Coco Price',
  version: '1.1.0',
  description: 'Market price integration (Binance + DexScreener)',
  async setup() {
    setPriceService(new BinancePriceService());
    dexService = new DexScreenerService();
    priceService.watchSymbol('BTC');
    priceService.watchSymbol('ETH');
    priceService.watchSymbol('BNB');
  },
  async teardown() {
    priceService.close();
  },
  tools: [getPriceTool, dexTokenTool],
};

export default pricePlugin;
