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
      return new Response(
        JSON.stringify({
          lastPrice: '61234.56',
          priceChange: '123.45',
          priceChangePercent: '2.06',
          highPrice: '62000.00',
          lowPrice: '60000.00',
        }),
        {
          status: 200,
        },
      );
    };

    const service = new BinancePriceService(fetchMock as typeof fetch);
    expect(await service.getPrice('btc')).toBe(61234.56);
    expect(await service.getPrice('BTCUSDT')).toBe(61234.56);
    expect(calls).toBe(1);
  });

  it('returns enriched 24h snapshot data', async () => {
    const service = new BinancePriceService(async () => {
      return new Response(
        JSON.stringify({
          lastPrice: '450.12',
          priceChange: '-12.34',
          priceChangePercent: '-2.67',
          highPrice: '470.00',
          lowPrice: '430.00',
        }),
        {
          status: 200,
        },
      );
    });

    const snapshot = await service.getSnapshot('BNB');
    expect(snapshot).toMatchObject({
      price: 450.12,
      change24h: -12.34,
      changePercent24h: -2.67,
      high24h: 470,
      low24h: 430,
    });
  });

  it('uses the exported tool contract', async () => {
    const service = new BinancePriceService(async () => {
      return new Response(
        JSON.stringify({
          lastPrice: '450.12',
          priceChange: '4.56',
          priceChangePercent: '1.02',
          highPrice: '455.00',
          lowPrice: '440.00',
        }),
        {
          status: 200,
        },
      );
    });
    setPriceService(service);

    const result = await getPriceTool.execute({} as CocoContext, {
      symbol: 'BNB',
    });
    expect(result.success).toBe(true);
    expect(result.text).toContain('BNBUSDT');
    expect(result.data).toMatchObject({
      symbol: 'BNBUSDT',
      price: 450.12,
      change24h: 4.56,
      changePercent24h: 1.02,
    });
  });
});
