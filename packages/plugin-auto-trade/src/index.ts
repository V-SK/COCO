import { randomUUID } from 'node:crypto';
import {
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  type PositionRecord,
  type RiskConfigSnapshot,
  SqliteStructuredStore,
  type StrategyRun,
} from '@coco/core';
import { z } from 'zod';

export const DEFAULT_RISK_CONFIG = {
  maxSingleTradeUsd: 1000,
  maxDailyLossUsd: 500,
  maxDailyTrades: 50,
  maxPositionPct: 20,
  maxOpenPositions: 10,
  stopLossPct: 30,
  cooldownAfterLossMs: 300_000,
} as const;

export interface UserRiskConfig {
  useDefaultTemplate: boolean;
  customConfig?:
    | Partial<Record<keyof typeof DEFAULT_RISK_CONFIG, number | undefined>>
    | undefined;
}

export interface AutoTradeConfig {
  mode: 'paper' | 'live';
  confirmBeforeExecute: boolean;
  userRisk?: UserRiskConfig | undefined;
  positionSizeUsd?: number | undefined;
  defaultSlippageBps?: number | undefined;
  defaultStopLossPct?: number | undefined;
  defaultTakeProfitPct?: number | undefined;
  intervalMs?: number | undefined;
  gridLevels?: number | undefined;
  trailingDistancePct?: number | undefined;
}

export interface Position extends PositionRecord {}

export interface TradeOrder {
  id: string;
  type: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL';
  token: string;
  amount: string;
  price?: string | undefined;
  stopLoss?: string | undefined;
  takeProfit?: string | undefined;
  status: 'PENDING' | 'CONFIRMED' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  txHash?: string | undefined;
  mode: 'paper' | 'live';
  strategy: string;
  createdAt: number;
  riskConfig: RiskConfigSnapshot;
}

export interface AutoTradePluginConfig {
  storagePath?: string | undefined;
}

function resolveRiskConfig(
  config?: UserRiskConfig | undefined,
): RiskConfigSnapshot {
  const useDefaultTemplate = config?.useDefaultTemplate ?? true;
  const resolvedEntries = Object.keys(DEFAULT_RISK_CONFIG).map((key) => {
    const typedKey = key as keyof typeof DEFAULT_RISK_CONFIG;
    const value = useDefaultTemplate
      ? (config?.customConfig?.[typedKey] ?? DEFAULT_RISK_CONFIG[typedKey])
      : (config?.customConfig?.[typedKey] ?? null);
    return [typedKey, value] as const;
  });
  return {
    useDefaultTemplate,
    resolved: Object.fromEntries(resolvedEntries),
    customConfig: config?.customConfig,
  };
}

class AutoTradeService {
  readonly #store: SqliteStructuredStore;

  constructor(storagePath?: string | undefined) {
    this.#store = new SqliteStructuredStore(
      storagePath ?? 'coco-auto-trade.sqlite',
    );
  }

  close() {
    this.#store.close();
  }

  listRuns(): StrategyRun[] {
    return this.#store.list<StrategyRun>('strategy-runs');
  }

  listPositions(): Position[] {
    return this.#store.list<Position>('positions');
  }

  listOrders(): TradeOrder[] {
    return this.#store.list<TradeOrder>('trade-orders');
  }

  async startStrategy(
    ctx: CocoContext,
    strategy: 'signal-follow' | 'dca' | 'grid' | 'trailing',
    token: string,
    config: AutoTradeConfig,
  ) {
    const riskConfig = resolveRiskConfig(config.userRisk);
    const run: StrategyRun = {
      id: randomUUID(),
      strategy,
      token: token.toUpperCase(),
      mode: config.mode,
      status: 'RUNNING',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      riskConfig,
      metadata: {
        config,
      },
    };
    this.#store.save('strategy-runs', run.id, run);
    ctx.runtime.logger.info(
      { strategy, token, riskConfig },
      'Auto-trade strategy started with risk config snapshot',
    );

    if (config.mode === 'paper') {
      const simulated = this.createOrderAndPosition(
        run,
        token,
        config,
        'EXECUTED',
        'paper-fill',
      );
      return {
        run,
        ...simulated,
      };
    }

    if (config.confirmBeforeExecute && ctx.metadata.tradeConfirmed !== true) {
      return {
        run,
        confirmation: {
          type: 'confirmation_required',
          operation: 'start_strategy',
          strategy,
          token: token.toUpperCase(),
          riskConfig,
        },
      };
    }

    const signalResult =
      strategy === 'signal-follow'
        ? await ctx.runtime.invokeTool('quant-signal.get-signal', ctx, {
            token,
          })
        : undefined;
    const signal =
      signalResult?.success && signalResult.data
        ? (signalResult.data as { type?: string; confidence?: number })
        : undefined;
    const shouldExecute =
      strategy !== 'signal-follow' ||
      !signal ||
      signal.type === 'BUY' ||
      signal.type == null;

    if (!shouldExecute) {
      run.status = 'PAUSED';
      run.updatedAt = Date.now();
      this.#store.save('strategy-runs', run.id, run);
      return {
        run,
        skipped: true,
        reason: `signal-follow received ${signal?.type ?? 'HOLD'}`,
      };
    }

    const amountUsd =
      config.positionSizeUsd ??
      (Number(riskConfig.resolved.maxSingleTradeUsd) || 1000);
    const liveResult = await this.dispatchLiveOrder(
      ctx,
      token,
      strategy,
      amountUsd,
      riskConfig,
      config.defaultSlippageBps ?? 300,
      config.defaultStopLossPct,
      config.defaultTakeProfitPct,
    );
    return {
      run,
      ...liveResult,
    };
  }

  stopStrategy(runId: string) {
    const run = this.#store.get<StrategyRun>('strategy-runs', runId);
    if (!run) {
      return undefined;
    }
    const updated: StrategyRun = {
      ...run,
      status: 'STOPPED',
      updatedAt: Date.now(),
    };
    this.#store.save('strategy-runs', runId, updated);
    return updated;
  }

  updatePosition(positionId: string, patch: Partial<Position>) {
    const current = this.#store.get<Position>('positions', positionId);
    if (!current) {
      return undefined;
    }
    const updated = {
      ...current,
      ...patch,
    };
    this.#store.save('positions', positionId, updated);
    return updated;
  }

  createOrderAndPosition(
    run: StrategyRun,
    token: string,
    config: AutoTradeConfig,
    status: TradeOrder['status'],
    txHash?: string | undefined,
  ) {
    const amountUsd = config.positionSizeUsd ?? 1000;
    const order: TradeOrder = {
      id: randomUUID(),
      type: 'MARKET',
      side: 'BUY',
      token: token.toUpperCase(),
      amount: String(amountUsd),
      status,
      txHash,
      mode: config.mode,
      strategy: run.strategy,
      createdAt: Date.now(),
      stopLoss: config.defaultStopLossPct
        ? String(config.defaultStopLossPct)
        : undefined,
      takeProfit: config.defaultTakeProfitPct
        ? String(config.defaultTakeProfitPct)
        : undefined,
      riskConfig: run.riskConfig,
    };
    const position: Position = {
      id: randomUUID(),
      token: token.toUpperCase(),
      side: 'LONG',
      entryPrice: '1',
      currentPrice: '1',
      size: String(amountUsd),
      sizeUsd: String(amountUsd),
      pnl: '0',
      pnlPct: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      strategy: run.strategy,
      status: 'OPEN',
      openedAt: Date.now(),
    };
    this.#store.save('trade-orders', order.id, order);
    this.#store.save('positions', position.id, position);
    return { order, position };
  }

  async dispatchLiveOrder(
    ctx: CocoContext,
    token: string,
    strategy: string,
    amountUsd: number,
    riskConfig: RiskConfigSnapshot,
    slippage: number,
    defaultStopLossPct?: number | undefined,
    defaultTakeProfitPct?: number | undefined,
  ) {
    const run: StrategyRun = {
      id: randomUUID(),
      strategy,
      token: token.toUpperCase(),
      mode: 'live',
      status: 'RUNNING',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      riskConfig,
    };
    const order: TradeOrder = {
      id: randomUUID(),
      type: 'MARKET',
      side: 'BUY',
      token: token.toUpperCase(),
      amount: String(amountUsd),
      status: 'PENDING',
      mode: 'live',
      strategy,
      createdAt: Date.now(),
      stopLoss: defaultStopLossPct ? String(defaultStopLossPct) : undefined,
      takeProfit: defaultTakeProfitPct
        ? String(defaultTakeProfitPct)
        : undefined,
      riskConfig,
    };
    this.#store.save('trade-orders', order.id, order);

    const quoteParams = {
      fromToken: 'USDT',
      toToken: token.toUpperCase(),
      amount: String(amountUsd),
      slippage,
    };
    const dexResult = await ctx.runtime.invokeTool(
      'dex-agg.execute-swap',
      ctx,
      quoteParams,
    );
    const execution =
      dexResult.success && dexResult.data
        ? dexResult
        : await ctx.runtime.invokeTool('swap.execute', ctx, quoteParams);

    if (!execution.success) {
      order.status = 'FAILED';
      this.#store.save('trade-orders', order.id, order);
      return { order, execution };
    }

    const txHash =
      typeof execution.data === 'object' && execution.data
        ? String(
            (execution.data as { txHash?: string; type?: string }).txHash ??
              (execution.data as { type?: string }).type ??
              'live-executed',
          )
        : 'live-executed';
    order.status = 'EXECUTED';
    order.txHash = txHash;
    this.#store.save('trade-orders', order.id, order);
    const position: Position = {
      id: randomUUID(),
      token: token.toUpperCase(),
      side: 'LONG',
      entryPrice: '1',
      currentPrice: '1',
      size: String(amountUsd),
      sizeUsd: String(amountUsd),
      pnl: '0',
      pnlPct: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      strategy,
      status: 'OPEN',
      openedAt: Date.now(),
    };
    this.#store.save('positions', position.id, position);
    return { order, position, execution };
  }
}

let autoTradeService = new AutoTradeService();

export function createAutoTradePlugin(
  config: AutoTradePluginConfig = {},
): CocoPlugin {
  const configSchema = z.object({
    mode: z.enum(['paper', 'live']).default('paper'),
    confirmBeforeExecute: z.boolean().default(true),
    userRisk: z
      .object({
        useDefaultTemplate: z.boolean(),
        customConfig: z
          .object({
            maxSingleTradeUsd: z.number().optional(),
            maxDailyLossUsd: z.number().optional(),
            maxDailyTrades: z.number().optional(),
            maxPositionPct: z.number().optional(),
            maxOpenPositions: z.number().optional(),
            stopLossPct: z.number().optional(),
            cooldownAfterLossMs: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    positionSizeUsd: z.number().optional(),
    defaultSlippageBps: z.number().optional(),
    defaultStopLossPct: z.number().optional(),
    defaultTakeProfitPct: z.number().optional(),
    intervalMs: z.number().optional(),
    gridLevels: z.number().optional(),
    trailingDistancePct: z.number().optional(),
  });
  const startSchema = z.object({
    strategy: z.enum(['signal-follow', 'dca', 'grid', 'trailing']),
    token: z.string(),
    config: configSchema,
  });
  const stopSchema = z.object({
    strategyRunId: z.string(),
  });
  const positionsSchema = z.object({
    token: z.string().optional(),
  });
  const stopLossSchema = z.object({
    positionId: z.string(),
    stopLossPrice: z.string(),
  });
  const takeProfitSchema = z.object({
    positionId: z.string(),
    takeProfitPrice: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'auto-trade.start-strategy',
      triggers: ['auto', 'trade', 'strategy'],
      description: 'Start an auto trade strategy in paper or live mode.',
      schema: startSchema,
      async execute(ctx, params: z.infer<typeof startSchema>) {
        return {
          success: true,
          data: await autoTradeService.startStrategy(
            ctx,
            params.strategy,
            params.token,
            params.config,
          ),
        };
      },
    },
    {
      id: 'auto-trade.stop-strategy',
      triggers: ['auto', 'trade', 'stop'],
      description: 'Stop an existing strategy run.',
      schema: stopSchema,
      async execute(_ctx, params: z.infer<typeof stopSchema>) {
        const run = autoTradeService.stopStrategy(params.strategyRunId);
        return run
          ? { success: true, data: run }
          : {
              success: false,
              error: 'Strategy run not found.',
              code: 'strategy_run_not_found',
            };
      },
    },
    {
      id: 'auto-trade.get-positions',
      triggers: ['auto', 'trade', 'positions'],
      description: 'List persisted auto-trade positions.',
      schema: positionsSchema,
      async execute(_ctx, params: z.infer<typeof positionsSchema>) {
        const positions = autoTradeService.listPositions();
        const token = params.token?.toUpperCase();
        return {
          success: true,
          data: params.token
            ? positions.filter((position) => position.token === token)
            : positions,
        };
      },
    },
    {
      id: 'auto-trade.set-stop-loss',
      triggers: ['auto', 'trade', 'stop-loss'],
      description: 'Set or update a stop loss on a position.',
      schema: stopLossSchema,
      async execute(_ctx, params: z.infer<typeof stopLossSchema>) {
        const position = autoTradeService.updatePosition(params.positionId, {
          stopLoss: params.stopLossPrice,
        });
        return position
          ? { success: true, data: position }
          : {
              success: false,
              error: 'Position not found.',
              code: 'position_not_found',
            };
      },
    },
    {
      id: 'auto-trade.set-take-profit',
      triggers: ['auto', 'trade', 'take-profit'],
      description: 'Set or update a take profit on a position.',
      schema: takeProfitSchema,
      async execute(_ctx, params: z.infer<typeof takeProfitSchema>) {
        const position = autoTradeService.updatePosition(params.positionId, {
          takeProfit: params.takeProfitPrice,
        });
        return position
          ? { success: true, data: position }
          : {
              success: false,
              error: 'Position not found.',
              code: 'position_not_found',
            };
      },
    },
  ];

  return {
    id: 'auto-trade',
    name: 'Coco Auto Trade',
    version: '1.2.0',
    description:
      'Paper and live strategy execution with configurable risk templates',
    async setup() {
      autoTradeService = new AutoTradeService(config.storagePath);
    },
    async teardown() {
      autoTradeService.close();
    },
    tools,
  };
}

export const autoTradePlugin = createAutoTradePlugin();

export default autoTradePlugin;
