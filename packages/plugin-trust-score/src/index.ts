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
    const team: ScoreModule = {
      score: 'N/A',
      weight: DEFAULT_WEIGHTS.team,
      details: { status: 'N/A', reason: 'team data unavailable in phase 3' },
    };
    const history: ScoreModule = {
      score: 'N/A',
      weight: DEFAULT_WEIGHTS.history,
      details: { status: 'N/A', reason: 'history data unavailable in phase 3' },
    };

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
    try {
      const url = new URL('https://api.bscscan.com/api');
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'tokentx');
      url.searchParams.set('contractaddress', token);
      url.searchParams.set('page', '1');
      url.searchParams.set('offset', '50');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('bscscan failed');
      }
      const payload = (await response.json()) as {
        result?: Array<{ from?: string; to?: string; value?: string }>;
      };
      const holders = new Set(
        (payload.result ?? [])
          .flatMap((entry) => [entry.from, entry.to])
          .filter((value): value is string => Boolean(value)),
      );
      const txCount = payload.result?.length ?? 0;
      const score = Math.max(0, Math.min(100, holders.size * 2 + txCount / 2));
      return {
        score: Math.round(score),
        weight: DEFAULT_WEIGHTS.holder,
        details: { distinctWallets: holders.size, sampledTransfers: txCount },
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
