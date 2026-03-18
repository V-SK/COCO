import {
  type BacktestResult,
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
} from '@coco/core';
import { z } from 'zod';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface SignalIndicator {
  name: string;
  value: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  weight: number;
}

export interface QuantSignal {
  token: string;
  type: SignalType;
  strength: SignalStrength;
  price: string;
  confidence: number;
  timestamp: number;
  strategy: string;
  indicators: SignalIndicator[];
  reasoning: string;
  expiry?: number | undefined;
}

export interface OnchainMetrics {
  token: string;
  holders: {
    total: number;
    top10Percent: number;
    newLast24h: number;
  };
  liquidity: {
    totalUsd: number;
    depth2Percent: number;
  };
  volume: {
    last24h: string;
    buyRatio: number;
    txCount: number;
  };
  smartMoney: {
    netFlow24h: string;
    whaleCount: number;
  };
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  analyze: (
    token: string,
    priceData: OHLCV[],
    onchainData: OnchainMetrics,
  ) => Promise<QuantSignal | null>;
}

export interface QuantSignalConfig {
  chainId?: number | undefined;
  storagePath?: string | undefined;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function ema(values: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const results: number[] = [];
  let current = values[0] ?? 0;
  for (const value of values) {
    current = (value - current) * multiplier + current;
    results.push(current);
  }
  return results;
}

export function calculateRsi(values: number[], period = 14): number {
  if (values.length <= period) {
    return 50;
  }
  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const current = values[index] ?? 0;
    const previous = values[index - 1] ?? current;
    const delta = current - previous;
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }
  if (losses === 0) {
    return 100;
  }
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function calculateMacd(values: number[]) {
  if (values.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdSeries = ema12.map(
    (value, index) => value - (ema26[index] ?? value),
  );
  const signalSeries = ema(macdSeries, 9);
  const macd = macdSeries.at(-1) ?? 0;
  const signal = signalSeries.at(-1) ?? 0;
  return { macd, signal, histogram: macd - signal };
}

export function calculateBollinger(values: number[], period = 20) {
  const scoped = values.slice(-period);
  const mid = scoped.length ? average(scoped) : 0;
  const variance =
    scoped.reduce((total, value) => total + (value - mid) ** 2, 0) /
    Math.max(scoped.length, 1);
  const deviation = Math.sqrt(variance);
  return {
    upper: mid + deviation * 2,
    middle: mid,
    lower: mid - deviation * 2,
  };
}

function signalFromValue(
  name: string,
  value: number,
  bullish: boolean,
  weight: number,
): SignalIndicator {
  return {
    name,
    value: Number(value.toFixed(4)),
    signal: bullish ? 'BULLISH' : value === 0 ? 'NEUTRAL' : 'BEARISH',
    weight,
  };
}

async function summarizeSignal(
  ctx: CocoContext,
  signal: QuantSignal,
  onchainData: OnchainMetrics,
): Promise<string> {
  try {
    const response = await ctx.runtime.llm.chat([
      {
        role: 'system',
        content:
          'Explain the trade signal in two concise sentences using only the supplied indicators and on-chain metrics.',
      },
      {
        role: 'user',
        content: JSON.stringify({ signal, onchainData }),
      },
    ]);
    return (
      response.content.trim() || `${signal.strategy} returned ${signal.type}.`
    );
  } catch {
    return `${signal.strategy} suggests ${signal.type} with ${signal.confidence}% confidence.`;
  }
}

class QuantSignalService {
  readonly #config: Required<Pick<QuantSignalConfig, 'chainId'>> &
    Omit<QuantSignalConfig, 'chainId'>;
  readonly #store: SqliteStructuredStore;
  readonly strategies: TradingStrategy[];

  constructor(config: QuantSignalConfig) {
    this.#config = {
      chainId: config.chainId ?? 56,
      storagePath: config.storagePath,
    };
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-quant-signal.sqlite',
    );
    this.strategies = [
      {
        id: 'momentum',
        name: 'Momentum',
        description: 'RSI and MACD trend follow strategy',
        timeframe: '1h',
        analyze: async (token, priceData, onchainData) =>
          await this.runMomentum(token, priceData, onchainData),
      },
      {
        id: 'mean-reversion',
        name: 'Mean Reversion',
        description: 'Bollinger and RSI reversal strategy',
        timeframe: '1h',
        analyze: async (token, priceData, onchainData) =>
          await this.runMeanReversion(token, priceData, onchainData),
      },
      {
        id: 'smart-money',
        name: 'Smart Money',
        description: 'Net flow and buy ratio strategy',
        timeframe: '4h',
        analyze: async (token, priceData, onchainData) =>
          await this.runSmartMoney(token, priceData, onchainData),
      },
    ];
  }

  close() {
    this.#store.close();
  }

  async getSignal(
    ctx: CocoContext,
    token: string,
    strategyId?: string | undefined,
  ): Promise<QuantSignal> {
    const priceData = await this.fetchPriceHistory(token, 60);
    const onchainData = await this.fetchOnchainMetrics(token);
    const activeStrategies = strategyId
      ? this.strategies.filter((strategy) => strategy.id === strategyId)
      : this.strategies;
    const signals = (
      await Promise.all(
        activeStrategies.map(
          async (strategy) =>
            await strategy.analyze(token.toUpperCase(), priceData, onchainData),
        ),
      )
    ).filter((value): value is QuantSignal => Boolean(value));
    const aggregated =
      signals.length === 1
        ? signals[0]
        : this.aggregateSignals(token.toUpperCase(), priceData, signals);
    if (!aggregated) {
      const fallback: QuantSignal = {
        token: token.toUpperCase(),
        type: 'HOLD',
        strength: 'WEAK',
        price: String(priceData.at(-1)?.close ?? 0),
        confidence: 0,
        timestamp: Date.now(),
        strategy: strategyId ?? 'composite',
        indicators: [],
        reasoning: 'No qualifying signal was produced for the current data.',
        expiry: Date.now() + 60 * 60 * 1000,
      };
      this.#store.save(
        'quant-signals',
        `${fallback.token}:${fallback.strategy}`,
        fallback,
      );
      return fallback;
    }
    aggregated.reasoning = await summarizeSignal(ctx, aggregated, onchainData);
    this.#store.save(
      'quant-signals',
      `${aggregated.token}:${aggregated.strategy}`,
      aggregated,
    );
    return aggregated;
  }

  async backtest(
    token: string,
    strategyId: string,
    days: number,
  ): Promise<BacktestResult> {
    const strategy = this.strategies.find((entry) => entry.id === strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${strategyId}`);
    }
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;
    const priceData = await this.fetchPriceHistory(
      token,
      Math.max(days * 24, 24),
    );
    const onchainData = await this.fetchOnchainMetrics(token);
    const coverage = {
      degraded: priceData.length < 30,
      price: priceData.length > 0,
      onchain: onchainData.holders.total > 0,
      news: false,
      notes: [] as string[],
    };
    if (priceData.length < 30) {
      coverage.notes.push('price history is limited; backtest is degraded');
    }
    coverage.notes.push('news history is not included in phase 3 backtests');
    const trades: BacktestResult['trades'] = [];
    let position: { entry: number } | undefined;
    for (let index = 30; index <= priceData.length; index += 1) {
      const scoped = priceData.slice(0, index);
      const signal = await strategy.analyze(
        token.toUpperCase(),
        scoped,
        onchainData,
      );
      const close = scoped.at(-1)?.close ?? 0;
      if (!signal) {
        continue;
      }
      if (signal.type === 'BUY' && !position) {
        position = { entry: close };
        trades.push({
          timestamp: scoped.at(-1)?.timestamp ?? Date.now(),
          side: 'BUY',
          price: close,
          reason: signal.strategy,
        });
      }
      if (signal.type === 'SELL' && position) {
        const pnl = ((close - position.entry) / position.entry) * 100;
        trades.push({
          timestamp: scoped.at(-1)?.timestamp ?? Date.now(),
          side: 'SELL',
          price: close,
          pnl: Number(pnl.toFixed(4)),
          reason: signal.strategy,
        });
        position = undefined;
      }
    }
    const closedTrades = trades.filter((trade) => trade.side === 'SELL');
    const totalReturnPct = Number(
      closedTrades
        .reduce((total, trade) => total + (trade.pnl ?? 0), 0)
        .toFixed(4),
    );
    const winRate = closedTrades.length
      ? Number(
          (
            closedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length /
            closedTrades.length
          ).toFixed(4),
        )
      : 0;
    const maxDrawdownPct = Number(
      Math.min(...closedTrades.map((trade) => trade.pnl ?? 0), 0).toFixed(4),
    );
    const result: BacktestResult = {
      token: token.toUpperCase(),
      strategy: strategy.id,
      startTime,
      endTime,
      trades,
      signalCount: trades.length,
      totalReturnPct,
      winRate,
      maxDrawdownPct,
      coverage,
    };
    this.#store.save(
      'backtests',
      `${result.token}:${strategy.id}:${days}`,
      result,
    );
    return result;
  }

  aggregateSignals(
    token: string,
    priceData: OHLCV[],
    signals: QuantSignal[],
  ): QuantSignal {
    const buyCount = signals.filter((signal) => signal.type === 'BUY').length;
    const sellCount = signals.filter((signal) => signal.type === 'SELL').length;
    const averageConfidence = Math.round(
      signals.reduce((total, signal) => total + signal.confidence, 0) /
        Math.max(signals.length, 1),
    );
    const type =
      buyCount === sellCount ? 'HOLD' : buyCount > sellCount ? 'BUY' : 'SELL';
    return {
      token,
      type,
      strength:
        averageConfidence >= 80
          ? 'STRONG'
          : averageConfidence >= 60
            ? 'MODERATE'
            : 'WEAK',
      price: String(priceData.at(-1)?.close ?? 0),
      confidence: averageConfidence,
      timestamp: Date.now(),
      strategy: 'composite',
      indicators: signals.flatMap((signal) => signal.indicators).slice(0, 6),
      reasoning: '',
      expiry: Date.now() + 60 * 60 * 1000,
    };
  }

  async runMomentum(
    token: string,
    priceData: OHLCV[],
    _onchainData: OnchainMetrics,
  ): Promise<QuantSignal> {
    const closes = priceData.map((candle) => candle.close);
    const rsi = calculateRsi(closes);
    const macd = calculateMacd(closes);
    const bullish = rsi > 55 && macd.histogram > 0;
    return {
      token,
      type: bullish ? 'BUY' : rsi < 45 && macd.histogram < 0 ? 'SELL' : 'HOLD',
      strength: Math.abs(macd.histogram) > 1 ? 'STRONG' : 'MODERATE',
      price: String(closes.at(-1) ?? 0),
      confidence: Math.round(
        Math.min(95, 50 + Math.abs(macd.histogram) * 15 + Math.abs(rsi - 50)),
      ),
      timestamp: Date.now(),
      strategy: 'momentum',
      indicators: [
        signalFromValue('RSI', rsi, rsi > 55, 0.45),
        signalFromValue('MACD', macd.histogram, macd.histogram > 0, 0.55),
      ],
      reasoning: '',
      expiry: Date.now() + 60 * 60 * 1000,
    };
  }

  async runMeanReversion(
    token: string,
    priceData: OHLCV[],
    _onchainData: OnchainMetrics,
  ): Promise<QuantSignal> {
    const closes = priceData.map((candle) => candle.close);
    const rsi = calculateRsi(closes);
    const bollinger = calculateBollinger(closes);
    const price = closes.at(-1) ?? 0;
    const buy = price < bollinger.lower && rsi < 35;
    const sell = price > bollinger.upper && rsi > 65;
    return {
      token,
      type: buy ? 'BUY' : sell ? 'SELL' : 'HOLD',
      strength: buy || sell ? 'MODERATE' : 'WEAK',
      price: String(price),
      confidence: Math.round(Math.min(90, 50 + Math.abs(rsi - 50))),
      timestamp: Date.now(),
      strategy: 'mean-reversion',
      indicators: [
        signalFromValue('RSI', rsi, rsi < 35, 0.5),
        signalFromValue('Bollinger', price - bollinger.middle, buy, 0.5),
      ],
      reasoning: '',
      expiry: Date.now() + 60 * 60 * 1000,
    };
  }

  async runSmartMoney(
    token: string,
    priceData: OHLCV[],
    onchainData: OnchainMetrics,
  ): Promise<QuantSignal> {
    const price = priceData.at(-1)?.close ?? 0;
    const netFlow = Number(onchainData.smartMoney.netFlow24h);
    const buyRatio = onchainData.volume.buyRatio;
    const bullish = netFlow > 0 && buyRatio >= 0.55;
    const bearish = netFlow < 0 && buyRatio <= 0.45;
    return {
      token,
      type: bullish ? 'BUY' : bearish ? 'SELL' : 'HOLD',
      strength: Math.abs(netFlow) > 100_000 ? 'STRONG' : 'MODERATE',
      price: String(price),
      confidence: Math.round(
        Math.min(
          92,
          50 + Math.abs(netFlow) / 10_000 + Math.abs(buyRatio - 0.5) * 100,
        ),
      ),
      timestamp: Date.now(),
      strategy: 'smart-money',
      indicators: [
        signalFromValue('SmartMoneyFlow', netFlow, bullish, 0.6),
        signalFromValue('BuyRatio', buyRatio, bullish, 0.4),
      ],
      reasoning: '',
      expiry: Date.now() + 4 * 60 * 60 * 1000,
    };
  }

  async fetchPriceHistory(token: string, points: number): Promise<OHLCV[]> {
    const symbol = token.toUpperCase();
    const supported = new Set(['BNB', 'BTC', 'ETH', 'CAKE', 'SOL']);
    if (!supported.has(symbol)) {
      const snapshot = await this.fetchDexSnapshot(token);
      return snapshot
        ? [
            {
              timestamp: Date.now(),
              open: snapshot,
              high: snapshot,
              low: snapshot,
              close: snapshot,
              volume: 0,
            },
          ]
        : [];
    }
    const response = await fetch(
      `https://api.binance.us/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=${points}`,
    );
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as Array<
      [number, string, string, string, string, string]
    >;
    return payload.map((entry) => ({
      timestamp: entry[0],
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
      volume: Number(entry[5]),
    }));
  }

  async fetchDexSnapshot(token: string): Promise<number | undefined> {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${token}`,
      );
      if (!response.ok) {
        return undefined;
      }
      const payload = (await response.json()) as {
        pairs?: Array<{ priceUsd?: string }>;
      };
      return Number(payload.pairs?.[0]?.priceUsd);
    } catch {
      return undefined;
    }
  }

  async fetchOnchainMetrics(token: string): Promise<OnchainMetrics> {
    try {
      const [dexResponse, bscResponse] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`),
        fetch(
          `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${token}&page=1&offset=50`,
        ),
      ]);
      const dexPayload = dexResponse.ok
        ? ((await dexResponse.json()) as {
            pairs?: Array<{
              liquidity?: { usd?: number };
              volume?: { h24?: number };
              txns?: { h24?: { buys?: number; sells?: number } };
            }>;
          })
        : {};
      const bscPayload = bscResponse.ok
        ? ((await bscResponse.json()) as {
            result?: Array<{ from?: string; to?: string; value?: string }>;
          })
        : {};
      const pair = dexPayload.pairs?.[0];
      const transfers = bscPayload.result ?? [];
      const holders = new Set(
        transfers
          .flatMap((transfer) => [transfer.from, transfer.to])
          .filter((value): value is string => Boolean(value)),
      );
      const buys = pair?.txns?.h24?.buys ?? 0;
      const sells = pair?.txns?.h24?.sells ?? 0;
      return {
        token: token.toUpperCase(),
        holders: {
          total: holders.size,
          top10Percent: Math.min(95, Math.max(5, 100 - holders.size / 2)),
          newLast24h: Math.round(holders.size * 0.15),
        },
        liquidity: {
          totalUsd: pair?.liquidity?.usd ?? 0,
          depth2Percent: Math.min(100, (pair?.liquidity?.usd ?? 0) / 10_000),
        },
        volume: {
          last24h: String(pair?.volume?.h24 ?? 0),
          buyRatio: buys + sells > 0 ? buys / (buys + sells) : 0.5,
          txCount: transfers.length,
        },
        smartMoney: {
          netFlow24h: String(
            ((buys - sells) * (pair?.volume?.h24 ?? 0)) /
              Math.max(buys + sells, 1),
          ),
          whaleCount: Math.max(0, Math.round(holders.size / 20)),
        },
      };
    } catch {
      return {
        token: token.toUpperCase(),
        holders: { total: 0, top10Percent: 0, newLast24h: 0 },
        liquidity: { totalUsd: 0, depth2Percent: 0 },
        volume: { last24h: '0', buyRatio: 0.5, txCount: 0 },
        smartMoney: { netFlow24h: '0', whaleCount: 0 },
      };
    }
  }
}

let quantSignalService = new QuantSignalService({});

export function createQuantSignalPlugin(
  config: QuantSignalConfig = {},
): CocoPlugin {
  const signalSchema = z.object({
    token: z.string(),
    strategy: z.string().optional(),
  });
  const backtestSchema = z.object({
    token: z.string(),
    strategy: z.string(),
    days: z.number().min(1).max(365),
  });

  const tools: CocoTool[] = [
    {
      id: 'quant-signal.get-signal',
      triggers: ['signal', 'quant', 'trade'],
      description:
        'Generate a quantitative trade signal from technical and on-chain data.',
      schema: signalSchema,
      async execute(ctx, params: z.infer<typeof signalSchema>) {
        return {
          success: true,
          data: await quantSignalService.getSignal(
            ctx,
            params.token,
            params.strategy,
          ),
        };
      },
    },
    {
      id: 'quant-signal.backtest',
      triggers: ['backtest', 'signal'],
      description:
        'Backtest a quantitative strategy using degraded third-party data.',
      schema: backtestSchema,
      async execute(_ctx, params: z.infer<typeof backtestSchema>) {
        return {
          success: true,
          data: await quantSignalService.backtest(
            params.token,
            params.strategy,
            params.days,
          ),
        };
      },
    },
    {
      id: 'quant-signal.list-strategies',
      triggers: ['signal', 'strategies'],
      description: 'List built-in quant strategies.',
      async execute() {
        return {
          success: true,
          data: quantSignalService.strategies.map((strategy) => ({
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
            timeframe: strategy.timeframe,
          })),
        };
      },
    },
  ];

  return {
    id: 'quant-signal',
    name: 'Coco Quant Signal',
    version: '1.2.0',
    description: 'Technical indicator and on-chain signal generation',
    async setup() {
      quantSignalService = new QuantSignalService(config);
    },
    async teardown() {
      quantSignalService.close();
    },
    tools,
  };
}

export const quantSignalPlugin = createQuantSignalPlugin();

export default quantSignalPlugin;
