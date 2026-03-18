import {
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
} from '@coco/core';
import { z } from 'zod';

const DEFAULT_WEIGHTS = {
  contract: 0.3,
  liquidity: 0.2,
  holder: 0.2,
  social: 0.1,
  team: 0.1,
  history: 0.1,
};

type ScoreValue = number | 'N/A';

export interface ScoreModule {
  score: ScoreValue;
  weight: number;
  details: Record<string, unknown>;
}

export interface Risk {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
}

export interface TrustScore {
  token: string;
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: number;
  coverage: number;
  breakdown: {
    contract: ScoreModule;
    liquidity: ScoreModule;
    holder: ScoreModule;
    social: ScoreModule;
    team: ScoreModule;
    history: ScoreModule;
  };
  risks: Risk[];
  flags: string[];
  recommendation: string;
}

export interface TrustScoreConfig {
  chainId?: number | undefined;
  goPlusApiBase?: string | undefined;
  storagePath?: string | undefined;
}

function toGrade(score: number): TrustScore['grade'] {
  if (score >= 80) {
    return 'A';
  }
  if (score >= 60) {
    return 'B';
  }
  if (score >= 40) {
    return 'C';
  }
  if (score >= 20) {
    return 'D';
  }
  return 'F';
}

async function generateRecommendation(
  ctx: CocoContext,
  score: Omit<TrustScore, 'recommendation'>,
): Promise<string> {
  try {
    const response = await ctx.runtime.llm.chat([
      {
        role: 'system',
        content:
          'Summarize token risk in two concise sentences using the provided scoring breakdown and risks.',
      },
      {
        role: 'user',
        content: JSON.stringify(score),
      },
    ]);
    return response.content.trim() || `Trust score is ${score.overall}.`;
  } catch {
    return `${score.token} is graded ${score.grade} with ${score.risks.length} highlighted risks.`;
  }
}

class TrustScoreService {
  readonly #config: Required<Pick<TrustScoreConfig, 'chainId'>> &
    Omit<TrustScoreConfig, 'chainId'>;
  readonly #store: SqliteStructuredStore;

  constructor(config: TrustScoreConfig) {
    this.#config = {
      chainId: config.chainId ?? 56,
      goPlusApiBase:
        config.goPlusApiBase ??
        'https://api.gopluslabs.io/api/v1/token_security',
      storagePath: config.storagePath,
    };
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-trust-score.sqlite',
    );
  }

  async score(ctx: CocoContext, token: string): Promise<TrustScore> {
    const normalizedToken = token.toUpperCase();
    const contract = await this.getContractScore(token);
    const liquidity = await this.getLiquidityScore(token);
    const holder = await this.getHolderScore(token);
    const social = await this.getSocialScore(ctx, normalizedToken);
    const team = await this.getTeamScore(token);
    const history = await this.getHistoryScore(token);

    const modules = { contract, liquidity, holder, social, team, history };
    const weighted = Object.values(modules).filter(
      (module): module is ScoreModule & { score: number } =>
        typeof module.score === 'number',
    );
    const totalWeight = weighted.reduce(
      (total, module) => total + module.weight,
      0,
    );
    const overall = totalWeight
      ? Math.round(
          weighted.reduce(
            (total, module) => total + module.score * module.weight,
            0,
          ) / totalWeight,
        )
      : 0;
    const risks = this.buildRisks(modules);
    const flags = risks
      .filter((risk) => risk.level === 'CRITICAL' || risk.level === 'HIGH')
      .map((risk) => `${risk.category}:${risk.level}`);
    const baseScore = {
      token: normalizedToken,
      overall,
      grade: toGrade(overall),
      timestamp: Date.now(),
      coverage: Math.round((weighted.length / 6) * 100),
      breakdown: modules,
      risks,
      flags,
    };
    const result: TrustScore = {
      ...baseScore,
      recommendation: await generateRecommendation(ctx, baseScore),
    };
    this.#store.save('trust-scores', normalizedToken, result);
    return result;
  }

  list(): TrustScore[] {
    return this.#store.list<TrustScore>('trust-scores');
  }

  close() {
    this.#store.close();
  }

  async getContractScore(token: string): Promise<ScoreModule> {
    try {
      const url = `${this.#config.goPlusApiBase}/${this.#config.chainId}?contract_addresses=${token}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('goplus failed');
      }
      const payload = (await response.json()) as {
        result?: Record<
          string,
          {
            is_honeypot?: string;
            is_blacklisted?: string;
            can_take_back_ownership?: string;
          }
        >;
      };
      const entry =
        payload.result?.[token.toLowerCase()] ?? payload.result?.[token];
      const penalties = [
        entry?.is_honeypot === '1' ? 50 : 0,
        entry?.is_blacklisted === '1' ? 30 : 0,
        entry?.can_take_back_ownership === '1' ? 20 : 0,
      ];
      const score = Math.max(0, 100 - penalties.reduce((a, b) => a + b, 0));
      return {
        score,
        weight: DEFAULT_WEIGHTS.contract,
        details: entry ?? { status: 'unavailable' },
      };
    } catch {
      return {
        score: 55,
        weight: DEFAULT_WEIGHTS.contract,
        details: { status: 'degraded', reason: 'GoPlus unavailable' },
      };
    }
  }

  async getLiquidityScore(token: string): Promise<ScoreModule> {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${token}`,
      );
      if (!response.ok) {
        throw new Error('dexscreener failed');
      }
      const payload = (await response.json()) as {
        pairs?: Array<{
          liquidity?: { usd?: number };
          priceChange?: { h24?: number };
          volume?: { h24?: number };
        }>;
      };
      const pair = payload.pairs?.[0];
      const liquidityUsd = pair?.liquidity?.usd ?? 0;
      const volume24h = pair?.volume?.h24 ?? 0;
      const score = Math.max(
        0,
        Math.min(
          100,
          liquidityUsd >= 1_000_000
            ? 95
            : liquidityUsd / 15_000 + volume24h / 20_000,
        ),
      );
      return {
        score: Math.round(score),
        weight: DEFAULT_WEIGHTS.liquidity,
        details: {
          liquidityUsd,
          volume24h,
          priceChange24h: pair?.priceChange?.h24 ?? 0,
        },
      };
    } catch {
      return {
        score: 50,
        weight: DEFAULT_WEIGHTS.liquidity,
        details: { status: 'degraded', reason: 'DexScreener unavailable' },
      };
    }
  }

  async getHolderScore(token: string): Promise<ScoreModule> {
    const apiKey = process.env['COCO_BSCSCAN_API_KEY'] ?? '';
    try {
      // Use GoPlus for holder concentration (already fetched in contract score, but we need top holders)
      const gpUrl = `https://api.gopluslabs.io/api/v1/token_security/${this.#config.chainId}?contract_addresses=${token}`;
      const gpRes = await fetch(gpUrl);
      const gpData = (await gpRes.json()) as {
        result?: Record<string, {
          holder_count?: string;
          holders?: Array<{ address: string; percent: string; is_locked?: number; is_contract?: number }>;
          lp_holder_count?: string;
          total_supply?: string;
        }>;
      };
      const entry = gpData.result?.[token.toLowerCase()] ?? gpData.result?.[token];
      const holderCount = Number(entry?.holder_count ?? 0);
      const topHolders = (entry?.holders ?? []).slice(0, 20);
      const top10Pct = topHolders.slice(0, 10).reduce((sum, h) => sum + Number(h.percent || 0), 0) * 100;
      const contractHolders = topHolders.filter(h => h.is_contract === 1).length;
      const lockedHolders = topHolders.filter(h => h.is_locked === 1).length;

      // Also try BscScan for recent transfer activity
      let recentTxCount = 0;
      let distinctWallets = 0;
      if (apiKey) {
        try {
          const bscUrl = new URL('https://api.etherscan.io/v2/api');
          bscUrl.searchParams.set('chainid', String(this.#config.chainId));
          bscUrl.searchParams.set('module', 'account');
          bscUrl.searchParams.set('action', 'tokentx');
          bscUrl.searchParams.set('contractaddress', token);
          bscUrl.searchParams.set('page', '1');
          bscUrl.searchParams.set('offset', '100');
          bscUrl.searchParams.set('sort', 'desc');
          bscUrl.searchParams.set('apikey', apiKey);
          const bscRes = await fetch(bscUrl);
          const bscData = (await bscRes.json()) as {
            result?: Array<{ from?: string; to?: string }>;
          };
          const wallets = new Set(
            (bscData.result ?? [])
              .flatMap((e) => [e.from, e.to])
              .filter((v): v is string => Boolean(v)),
          );
          recentTxCount = bscData.result?.length ?? 0;
          distinctWallets = wallets.size;
        } catch { /* BscScan optional */ }
      }

      // Score: holder count + distribution + activity
      let score = 0;
      // Holder count component (max 40)
      if (holderCount >= 10000) score += 40;
      else if (holderCount >= 1000) score += 30;
      else if (holderCount >= 100) score += 15;
      else score += 5;
      // Distribution component (max 30) — lower top10 concentration = better
      if (top10Pct < 20) score += 30;
      else if (top10Pct < 40) score += 20;
      else if (top10Pct < 60) score += 10;
      else score += 0;
      // Activity component (max 30)
      score += Math.min(30, recentTxCount / 3 + distinctWallets / 2);

      return {
        score: Math.min(100, Math.round(score)),
        weight: DEFAULT_WEIGHTS.holder,
        details: {
          holderCount,
          top10ConcentrationPct: Math.round(top10Pct * 100) / 100,
          contractHolders,
          lockedHolders,
          recentTransfers: recentTxCount,
          distinctWallets,
          topHolders: topHolders.slice(0, 5).map(h => ({
            address: h.address,
            percent: (Number(h.percent) * 100).toFixed(2) + '%',
            isContract: h.is_contract === 1,
            isLocked: h.is_locked === 1,
          })),
        },
      };
    } catch {
      return {
        score: 'N/A',
        weight: DEFAULT_WEIGHTS.holder,
        details: { status: 'N/A', reason: 'holder data unavailable' },
      };
    }
  }

  async getSocialScore(ctx: CocoContext, token: string): Promise<ScoreModule> {
    const result = await ctx.runtime.invokeTool('news.get-sentiment', ctx, {
      token,
      period: '24h',
    });
    if (!result.success || !result.data) {
      return {
        score: 'N/A',
        weight: DEFAULT_WEIGHTS.social,
        details: { status: 'N/A', reason: 'social/news data unavailable' },
      };
    }
    const sentiment = result.data as {
      overall?: number;
      newsCount?: number;
      aiSummary?: string;
    };
    const overall = sentiment.overall ?? 0;
    const score = Math.max(0, Math.min(100, 50 + overall / 2));
    return {
      score: Math.round(score),
      weight: DEFAULT_WEIGHTS.social,
      details: {
        newsCount: sentiment.newsCount ?? 0,
        aiSummary: sentiment.aiSummary ?? '',
      },
    };
  }

  async getTeamScore(token: string): Promise<ScoreModule> {
    try {
      // Check if contract is verified + has owner renounced from GoPlus
      const url = `https://api.gopluslabs.io/api/v1/token_security/${this.#config.chainId}?contract_addresses=${token}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        result?: Record<string, {
          is_open_source?: string;
          owner_address?: string;
          creator_address?: string;
          can_take_back_ownership?: string;
          owner_change_balance?: string;
        }>;
      };
      const entry = data.result?.[token.toLowerCase()] ?? data.result?.[token];
      if (!entry) {
        return { score: 'N/A', weight: DEFAULT_WEIGHTS.team, details: { status: 'N/A' } };
      }
      let score = 50; // base
      if (entry.is_open_source === '1') score += 20;
      if (entry.can_take_back_ownership === '0') score += 15;
      if (entry.owner_change_balance === '0') score += 15;
      // Null owner = renounced
      if (entry.owner_address === '0x0000000000000000000000000000000000000000') score += 10;

      return {
        score: Math.min(100, score),
        weight: DEFAULT_WEIGHTS.team,
        details: {
          isOpenSource: entry.is_open_source === '1',
          ownerAddress: entry.owner_address ?? 'unknown',
          creatorAddress: entry.creator_address ?? 'unknown',
          ownershipRenounced: entry.owner_address === '0x0000000000000000000000000000000000000000',
          canTakeBackOwnership: entry.can_take_back_ownership === '1',
          ownerCanChangeBalance: entry.owner_change_balance === '1',
        },
      };
    } catch {
      return { score: 'N/A', weight: DEFAULT_WEIGHTS.team, details: { status: 'N/A' } };
    }
  }

  async getHistoryScore(token: string): Promise<ScoreModule> {
    try {
      // Use DexScreener pair age + price stability
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`);
      const data = (await res.json()) as {
        pairs?: Array<{
          pairCreatedAt?: number;
          priceChange?: { h24?: number; h6?: number };
          txns?: { h24?: { buys: number; sells: number } };
          volume?: { h24?: number };
        }>;
      };
      const pair = data.pairs?.[0];
      if (!pair) {
        return { score: 'N/A', weight: DEFAULT_WEIGHTS.history, details: { status: 'N/A' } };
      }

      const ageMs = Date.now() - (pair.pairCreatedAt ?? Date.now());
      const ageDays = ageMs / 86_400_000;
      const change24h = Math.abs(pair.priceChange?.h24 ?? 0);
      const totalTxns = (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0);

      let score = 0;
      // Age component (max 40) — older = more trustworthy
      if (ageDays >= 90) score += 40;
      else if (ageDays >= 30) score += 30;
      else if (ageDays >= 7) score += 15;
      else score += 5;
      // Volatility component (max 30) — lower = more stable
      if (change24h < 5) score += 30;
      else if (change24h < 15) score += 20;
      else if (change24h < 30) score += 10;
      else score += 0;
      // Activity component (max 30)
      score += Math.min(30, totalTxns / 10);

      return {
        score: Math.min(100, Math.round(score)),
        weight: DEFAULT_WEIGHTS.history,
        details: {
          ageDays: Math.round(ageDays),
          change24hPct: pair.priceChange?.h24 ?? 0,
          totalTxns24h: totalTxns,
          volume24h: pair.volume?.h24 ?? 0,
        },
      };
    } catch {
      return { score: 'N/A', weight: DEFAULT_WEIGHTS.history, details: { status: 'N/A' } };
    }
  }

    buildRisks(breakdown: TrustScore['breakdown']): Risk[] {
    const risks: Risk[] = [];
    for (const [category, module] of Object.entries(breakdown)) {
      if (module.score === 'N/A') {
        risks.push({
          level: 'LOW',
          category,
          description: `${category} data is unavailable in this environment.`,
        });
        continue;
      }
      if (module.score < 25) {
        risks.push({
          level: 'CRITICAL',
          category,
          description: `${category} score is critically low.`,
        });
      } else if (module.score < 45) {
        risks.push({
          level: 'HIGH',
          category,
          description: `${category} score is below the preferred threshold.`,
        });
      } else if (module.score < 65) {
        risks.push({
          level: 'MEDIUM',
          category,
          description: `${category} score is mixed.`,
        });
      }
    }
    return risks;
  }
}

let trustScoreService = new TrustScoreService({});

export function createTrustScorePlugin(
  config: TrustScoreConfig = {},
): CocoPlugin {
  const tokenSchema = z.object({
    token: z.string(),
    detailed: z.boolean().optional(),
  });
  const compareSchema = z.object({
    tokens: z.array(z.string()).min(2).max(5),
  });
  const explainSchema = z.object({
    token: z.string(),
    module: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'trust-score.get-trust-score',
      triggers: ['trust', 'score', 'risk'],
      description: 'Get a normalized token trust score and breakdown.',
      schema: tokenSchema,
      async execute(ctx, params: z.infer<typeof tokenSchema>) {
        const score = await trustScoreService.score(ctx, params.token);
        if (params.detailed) {
          return { success: true, data: score };
        }
        return {
          success: true,
          data: {
            token: score.token,
            overall: score.overall,
            grade: score.grade,
            coverage: score.coverage,
            flags: score.flags,
            recommendation: score.recommendation,
          },
        };
      },
    },
    {
      id: 'trust-score.compare-tokens',
      triggers: ['trust', 'compare'],
      description: 'Compare multiple token trust scores.',
      schema: compareSchema,
      async execute(ctx, params: z.infer<typeof compareSchema>) {
        const scores = await Promise.all(
          params.tokens.map(
            async (token) => await trustScoreService.score(ctx, token),
          ),
        );
        return {
          success: true,
          data: scores.sort((left, right) => right.overall - left.overall),
        };
      },
    },
    {
      id: 'trust-score.explain-score',
      triggers: ['trust', 'explain'],
      description:
        'Explain an existing token trust score or a specific module.',
      schema: explainSchema,
      async execute(ctx, params: z.infer<typeof explainSchema>) {
        const score = await trustScoreService.score(ctx, params.token);
        if (!params.module) {
          return {
            success: true,
            data: {
              token: score.token,
              explanation: score.recommendation,
            },
          };
        }
        const module =
          score.breakdown[params.module as keyof TrustScore['breakdown']];
        if (!module) {
          return {
            success: false,
            error: 'Requested trust-score module does not exist.',
            code: 'trust_score_module_not_found',
          };
        }
        return {
          success: true,
          data: {
            token: score.token,
            module: params.module,
            explanation:
              module.score === 'N/A'
                ? `${params.module} is marked N/A in this environment.`
                : `${params.module} scored ${module.score} with details: ${JSON.stringify(module.details)}`,
          },
        };
      },
    },
  ];

  return {
    id: 'trust-score',
    name: 'Coco Trust Score',
    version: '1.2.0',
    description: 'Weighted token trust scoring with structured risk output',
    async setup() {
      trustScoreService = new TrustScoreService(config);
    },
    async teardown() {
      trustScoreService.close();
    },
    tools,
  };
}

export const trustScorePlugin = createTrustScorePlugin();

export default trustScorePlugin;
