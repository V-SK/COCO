import { randomUUID } from 'node:crypto';
import {
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
} from '@coco/core';
import { z } from 'zod';

const DEFAULT_RSS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://www.theblock.co/rss.xml',
];

const TOKEN_ALIASES: Record<string, string[]> = {
  BNB: ['bnb', 'binance coin', 'binance'],
  BTC: ['btc', 'bitcoin'],
  ETH: ['eth', 'ethereum'],
  SOL: ['sol', 'solana'],
  CAKE: ['cake', 'pancakeswap'],
  USDT: ['usdt', 'tether'],
  USDC: ['usdc', 'usd coin'],
};

const BULLISH_TERMS = [
  'bullish',
  'surge',
  'gain',
  'buy',
  'rally',
  'approval',
  'accumulate',
  'partnership',
];
const BEARISH_TERMS = [
  'bearish',
  'sell',
  'drop',
  'hack',
  'exploit',
  'lawsuit',
  'outflow',
  'dump',
];

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  tokens: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  sentimentScore: number;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SentimentSummary {
  token: string;
  period: '1h' | '24h' | '7d';
  overall: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  newsCount: number;
  bullishCount: number;
  bearishCount: number;
  topHeadlines: string[];
  aiSummary: string;
}

export interface NewsConfig {
  rssFeeds?: string[] | undefined;
  cryptoPanicApiKey?: string | undefined;
  storagePath?: string | undefined;
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractItemValue(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1] ? decodeEntities(stripTags(match[1])) : undefined;
}

function extractTokens(text: string): string[] {
  const normalized = text.toLowerCase();
  return Object.entries(TOKEN_ALIASES)
    .filter(([, aliases]) =>
      aliases.some((alias) => normalized.includes(alias)),
    )
    .map(([symbol]) => symbol);
}

function scoreSentiment(
  title: string,
  summary: string,
): Pick<NewsItem, 'sentiment' | 'sentimentScore' | 'importance'> {
  const content = `${title} ${summary}`.toLowerCase();
  const bullish = BULLISH_TERMS.filter((term) => content.includes(term)).length;
  const bearish = BEARISH_TERMS.filter((term) => content.includes(term)).length;
  const delta = bullish - bearish;
  const sentiment = delta > 0 ? 'BULLISH' : delta < 0 ? 'BEARISH' : 'NEUTRAL';
  const sentimentScore = Math.max(-100, Math.min(100, delta * 20));
  const importance =
    Math.abs(sentimentScore) >= 60
      ? 'HIGH'
      : Math.abs(sentimentScore) >= 20
        ? 'MEDIUM'
        : 'LOW';
  return { sentiment, sentimentScore, importance };
}

async function summarizeWithLlm(
  ctx: CocoContext,
  summary: SentimentSummary,
): Promise<string> {
  try {
    const response = await ctx.runtime.llm.chat([
      {
        role: 'system',
        content:
          'Summarize crypto news sentiment in two concise sentences using only the provided structured data.',
      },
      {
        role: 'user',
        content: JSON.stringify(summary),
      },
    ]);
    return (
      response.content.trim() ||
      `Sentiment for ${summary.token} is ${summary.overall}.`
    );
  } catch {
    return `${summary.token} sentiment is ${summary.trend.toLowerCase()} with ${summary.newsCount} recent articles.`;
  }
}

class NewsService {
  readonly #rssFeeds: string[];
  readonly #cryptoPanicApiKey: string | undefined;
  readonly #store: SqliteStructuredStore;

  constructor(config: NewsConfig) {
    this.#rssFeeds = config.rssFeeds ?? DEFAULT_RSS_FEEDS;
    this.#cryptoPanicApiKey = config.cryptoPanicApiKey;
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-news.sqlite',
    );
  }

  async refresh(): Promise<NewsItem[]> {
    const items = [
      ...(await this.fetchRssItems()),
      ...(await this.fetchCryptoPanicItems()),
    ];
    const deduped = new Map<string, NewsItem>();
    for (const item of items) {
      deduped.set(item.url, item);
      this.#store.save('news-items', item.id, item);
    }
    return [...deduped.values()].sort(
      (left, right) => right.publishedAt - left.publishedAt,
    );
  }

  list(): NewsItem[] {
    return this.#store.list<NewsItem>('news-items');
  }

  async getNews(token?: string): Promise<NewsItem[]> {
    const cached = this.list();
    if (cached.length === 0) {
      await this.refresh();
    }
    const items = this.list();
    return token
      ? items.filter((item) => item.tokens.includes(token.toUpperCase()))
      : items;
  }

  search(query: string): NewsItem[] {
    const normalized = query.toLowerCase();
    return this.list().filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.summary.toLowerCase().includes(normalized),
    );
  }

  async getSentiment(
    ctx: CocoContext,
    token: string,
    period: SentimentSummary['period'],
  ): Promise<SentimentSummary> {
    const items = await this.getNews(token);
    const windowMs =
      period === '1h'
        ? 60 * 60 * 1000
        : period === '24h'
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    const scoped = items.filter((item) => item.publishedAt >= cutoff);
    const bullishCount = scoped.filter(
      (item) => item.sentiment === 'BULLISH',
    ).length;
    const bearishCount = scoped.filter(
      (item) => item.sentiment === 'BEARISH',
    ).length;
    const overall = scoped.length
      ? Math.round(
          scoped.reduce((total, item) => total + item.sentimentScore, 0) /
            scoped.length,
        )
      : 0;
    const summary: SentimentSummary = {
      token: token.toUpperCase(),
      period,
      overall,
      trend: overall > 10 ? 'UP' : overall < -10 ? 'DOWN' : 'STABLE',
      newsCount: scoped.length,
      bullishCount,
      bearishCount,
      topHeadlines: scoped.slice(0, 3).map((item) => item.title),
      aiSummary: '',
    };
    summary.aiSummary = await summarizeWithLlm(ctx, summary);
    this.#store.save('sentiment', `${summary.token}:${period}`, summary);
    return summary;
  }

  close() {
    this.#store.close();
  }

  async fetchRssItems(): Promise<NewsItem[]> {
    const items = await Promise.all(
      this.#rssFeeds.map(async (feed) => {
        try {
          const response = await fetch(feed);
          if (!response.ok) {
            return [];
          }
          const xml = await response.text();
          const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(
            (match) => match[1] ?? '',
          );
          return blocks.map((block) => {
            const title = extractItemValue(block, 'title') ?? 'Untitled';
            const summary =
              extractItemValue(block, 'description') ?? 'No summary available.';
            const url = extractItemValue(block, 'link') ?? randomUUID();
            const publishedAt = Date.parse(
              extractItemValue(block, 'pubDate') ?? '',
            );
            const sentimentMeta = scoreSentiment(title, summary);
            return {
              id: randomUUID(),
              title,
              summary,
              url,
              source: feed,
              publishedAt: Number.isFinite(publishedAt)
                ? publishedAt
                : Date.now(),
              tokens: extractTokens(`${title} ${summary}`),
              ...sentimentMeta,
            } satisfies NewsItem;
          });
        } catch {
          return [];
        }
      }),
    );
    return items.flat();
  }

  async fetchCryptoPanicItems(): Promise<NewsItem[]> {
    try {
      const url = new URL('https://cryptopanic.com/api/v1/posts/');
      if (this.#cryptoPanicApiKey) {
        url.searchParams.set('auth_token', this.#cryptoPanicApiKey);
      }
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const payload = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          published_at?: string;
          source?: { title?: string };
          currencies?: Array<{ code?: string }>;
        }>;
      };
      return (payload.results ?? []).map((item) => {
        const title = item.title ?? 'Untitled';
        const summary = title;
        const sentimentMeta = scoreSentiment(title, summary);
        return {
          id: randomUUID(),
          title,
          summary,
          url: item.url ?? randomUUID(),
          source: item.source?.title ?? 'cryptopanic',
          publishedAt: item.published_at
            ? Date.parse(item.published_at)
            : Date.now(),
          tokens:
            item.currencies
              ?.map((currency) => currency.code?.toUpperCase())
              .filter((value): value is string => Boolean(value)) ?? [],
          ...sentimentMeta,
        } satisfies NewsItem;
      });
    } catch {
      return [];
    }
  }
}

let newsService = new NewsService({});

export function createNewsPlugin(config: NewsConfig = {}): CocoPlugin {
  const getNewsSchema = z.object({
    token: z.string().optional(),
    limit: z.number().optional(),
    minImportance: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  });
  const getSentimentSchema = z.object({
    token: z.string(),
    period: z.enum(['1h', '24h', '7d']).optional(),
  });
  const searchSchema = z.object({
    query: z.string(),
    limit: z.number().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'news.get-news',
      triggers: ['news', 'headlines'],
      description: 'Get aggregated crypto news and cached sentiment metadata.',
      schema: getNewsSchema,
      async execute(_ctx, params: z.infer<typeof getNewsSchema>) {
        const items = await newsService.getNews(params.token);
        const minImportance =
          params.minImportance === 'HIGH'
            ? ['HIGH']
            : params.minImportance === 'MEDIUM'
              ? ['HIGH', 'MEDIUM']
              : ['HIGH', 'MEDIUM', 'LOW'];
        return {
          success: true,
          data: items
            .filter((item) => minImportance.includes(item.importance))
            .slice(0, params.limit ?? 10),
        };
      },
    },
    {
      id: 'news.get-sentiment',
      triggers: ['news', 'sentiment'],
      description:
        'Summarize token sentiment from cached and freshly fetched news.',
      schema: getSentimentSchema,
      async execute(ctx, params: z.infer<typeof getSentimentSchema>) {
        return {
          success: true,
          data: await newsService.getSentiment(
            ctx,
            params.token,
            params.period ?? '24h',
          ),
        };
      },
    },
    {
      id: 'news.search-news',
      triggers: ['news', 'search'],
      description: 'Search the local crypto news cache.',
      schema: searchSchema,
      async execute(_ctx, params: z.infer<typeof searchSchema>) {
        const items = newsService.search(params.query);
        return { success: true, data: items.slice(0, params.limit ?? 10) };
      },
    },
  ];

  return {
    id: 'news',
    name: 'Coco News',
    version: '1.2.0',
    description: 'Aggregates RSS and CryptoPanic feeds with cached sentiment',
    async setup() {
      newsService = new NewsService(config);
      await newsService.refresh();
    },
    async teardown() {
      newsService.close();
    },
    tools,
  };
}

export const newsPlugin = createNewsPlugin();

export default newsPlugin;
