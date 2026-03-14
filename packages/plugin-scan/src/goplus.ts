import { CocoError } from '@coco/core';
import { isAddress } from 'ethers';

export interface ScanSummary {
  address: string;
  trustScore: number;
  risks: string[];
  raw: Record<string, unknown>;
}

function scoreResult(raw: Record<string, unknown>): {
  trustScore: number;
  risks: string[];
} {
  const riskWeights: Array<[string, number, string]> = [
    ['is_honeypot', 40, 'honeypot risk'],
    ['can_take_back_ownership', 20, 'owner can reclaim ownership'],
    ['is_proxy', 10, 'proxy contract'],
    ['is_blacklisted', 30, 'blacklist capability'],
    ['hidden_owner', 15, 'hidden owner detected'],
    ['selfdestruct', 20, 'self-destruct capability'],
  ];

  let score = 100;
  const risks: string[] = [];

  for (const [field, penalty, label] of riskWeights) {
    if (raw[field] === '1') {
      score -= penalty;
      risks.push(label);
    }
  }

  return {
    trustScore: Math.max(0, score),
    risks,
  };
}

export class GoPlusService {
  readonly #fetch: typeof globalThis.fetch;

  constructor(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.#fetch = fetchImpl;
  }

  async scan(address: string, chainId = 56): Promise<ScanSummary> {
    if (!isAddress(address)) {
      throw new CocoError(
        'Contract address is invalid.',
        'invalid_contract_address',
      );
    }

    const response = await this.#fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
    );
    if (!response.ok) {
      throw new CocoError('GoPlus request failed.', 'goplus_request_failed');
    }

    const payload = (await response.json()) as {
      result?: Record<string, Record<string, unknown>>;
    };
    const result =
      payload.result?.[address.toLowerCase()] ??
      payload.result?.[address] ??
      {};
    const { trustScore, risks } = scoreResult(result);

    return {
      address,
      trustScore,
      risks,
      raw: result,
    };
  }
}
