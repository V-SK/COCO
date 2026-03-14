import type { CocoContext } from '@coco/core';
import { describe, expect, it } from 'vitest';
import { GoPlusService } from './goplus.js';
import { setGoPlusService } from './index.js';
import { scanContractTool } from './tools/scan-contract.js';

const address = '0x0000000000000000000000000000000000001234';

describe('GoPlusService', () => {
  it('normalizes GoPlus responses into trust scores', async () => {
    const service = new GoPlusService(async () => {
      return new Response(
        JSON.stringify({
          result: {
            [address.toLowerCase()]: {
              is_honeypot: '1',
              hidden_owner: '1',
            },
          },
        }),
        { status: 200 },
      );
    });

    const result = await service.scan(address);
    expect(result.trustScore).toBe(45);
    expect(result.risks).toContain('honeypot risk');
  });

  it('returns user-facing scan text through the tool', async () => {
    setGoPlusService(
      new GoPlusService(async () => {
        return new Response(
          JSON.stringify({
            result: {
              [address.toLowerCase()]: {
                is_proxy: '0',
              },
            },
          }),
          { status: 200 },
        );
      }),
    );

    const result = await scanContractTool.execute(
      { chainId: 56 } as CocoContext,
      { address },
    );
    expect(result.success).toBe(true);
    expect(result.text).toContain('Trust Score');
  });
});
