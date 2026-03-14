import { describe, expect, it } from 'vitest';
import { resolveToken } from './tokens.js';

describe('resolveToken', () => {
  it('resolves known symbols and raw addresses', () => {
    expect(resolveToken('BNB')).toMatchObject({
      symbol: 'BNB',
      isNative: true,
    });
    expect(
      resolveToken('0x0000000000000000000000000000000000001234'),
    ).toMatchObject({
      address: '0x0000000000000000000000000000000000001234',
      isNative: false,
    });
  });
});
