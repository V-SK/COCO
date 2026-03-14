import type { CocoContext } from '@coco/core';
import { describe, expect, it } from 'vitest';
import { BinancePriceService } from './binance.js';
import { priceService, setPriceService } from './index.js';
import { getPriceTool } from './tools/get-price.js';

describe('BinancePriceService', () => {
  it('normalizes symbols and caches REST lookups', async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls += 1;
      return new Response(JSON.stringify({ price: '61234.56' }), {
        status: 200,
      });
    };

    const service = new BinancePriceService(fetchMock as typeof fetch);
    expect(await service.getPrice('btc')).toBe(61234.56);
    expect(await service.getPrice('BTCUSDT')).toBe(61234.56);
    expect(calls).toBe(1);
  });

  it('uses the exported tool contract', async () => {
    const service = new BinancePriceService(async () => {
      return new Response(JSON.stringify({ price: '450.12' }), {
        status: 200,
      });
    });
    setPriceService(service);

    const result = await getPriceTool.execute({} as CocoContext, {
      symbol: 'BNB',
    });
    expect(result.success).toBe(true);
    expect(result.text).toContain('BNBUSDT');
  });
});
