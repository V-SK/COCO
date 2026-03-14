import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletService, resolveWalletToken } from './provider.js';

describe('WalletService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves known wallet tokens', () => {
    const token = resolveWalletToken('usdt');
    expect(token.symbol).toBe('USDT');
    expect(token.isNative).toBe(false);
  });

  it('builds native and ERC20 transfer transactions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const price = url.includes('BNBUSDT') ? '600' : '1';
        return new Response(JSON.stringify({ price }), {
          status: 200,
        });
      }),
    );

    const service = new WalletService('https://bsc-dataseed.binance.org');
    const nativeTx = await service.buildTransferTx(
      'BNB',
      '0x0000000000000000000000000000000000009999',
      '1.5',
    );
    const tokenTx = await service.buildTransferTx(
      'USDT',
      '0x0000000000000000000000000000000000009999',
      '20',
    );

    expect(nativeTx.tx.value).toBe('1500000000000000000');
    expect(nativeTx.amountUsd).toBe(900);
    expect(String(tokenTx.tx.data)).toContain('0xa9059cbb');
    expect(tokenTx.amountUsd).toBe(20);
  });
});
