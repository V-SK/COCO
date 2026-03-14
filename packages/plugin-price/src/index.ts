import type { CocoPlugin } from '@coco/core';
import { BinancePriceService } from './binance.js';
import { getPriceTool } from './tools/get-price.js';

export let priceService = new BinancePriceService();

export function setPriceService(service: BinancePriceService): void {
  priceService = service;
}

export const pricePlugin: CocoPlugin = {
  id: 'price',
  name: 'Coco Price',
  version: '1.0.0',
  description: 'Binance market price integration',
  async setup() {
    setPriceService(new BinancePriceService());
    priceService.watchSymbol('BTC');
    priceService.watchSymbol('ETH');
    priceService.watchSymbol('BNB');
  },
  async teardown() {
    priceService.close();
  },
  tools: [getPriceTool],
};

export default pricePlugin;
