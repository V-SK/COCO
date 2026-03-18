import { randomUUID } from 'node:crypto';
import type { CocoPlugin, CocoRuntime, CocoTool } from '@coco/core';
import Database from 'better-sqlite3';
import { JsonRpcProvider } from 'ethers';
import { z } from 'zod';

export interface ChainEventsConfig {
  rpcUrl: string;
  wsUrl?: string | undefined;
  confirmations?: number | undefined;
  pollInterval?: number | undefined;
  storagePath?: string | undefined;
}

export interface WatchConfig {
  id: string;
  type: 'address' | 'contract' | 'token' | 'price';
  target: string;
  events?: string[] | undefined;
  conditions?:
    | {
        minValue?: string | undefined;
        maxValue?: string | undefined;
        direction?: 'in' | 'out' | 'both' | undefined;
      }
    | undefined;
  callback: {
    type: 'tool_call' | 'webhook' | 'alert';
    config: unknown;
  };
}

class WatchStore {
  readonly #db: Database.Database;

  constructor(path: string) {
    this.#db = new Database(path);
    this.#db.exec(`
      create table if not exists chain_watches (
        id text primary key,
        payload text not null
      );
    `);
  }

  save(config: WatchConfig) {
    this.#db
      .prepare(
        'insert or replace into chain_watches (id, payload) values (?, ?)',
      )
      .run(config.id, JSON.stringify(config));
  }

  list(): WatchConfig[] {
    return this.#db
      .prepare('select payload from chain_watches')
      .all()
      .map(
        (row) =>
          JSON.parse((row as { payload: string }).payload) as WatchConfig,
      );
  }

  delete(id: string) {
    this.#db.prepare('delete from chain_watches where id = ?').run(id);
  }
}

class ChainEventsService {
  readonly #runtime: CocoRuntime;
  readonly #provider: JsonRpcProvider;
  readonly #store: WatchStore;
  readonly #timers = new Map<string, NodeJS.Timeout>();
  readonly #config: ChainEventsConfig;

  constructor(runtime: CocoRuntime, config: ChainEventsConfig) {
    this.#runtime = runtime;
    this.#provider = new JsonRpcProvider(config.rpcUrl);
    this.#store = new WatchStore(
      config.storagePath ?? 'coco-chain-events.sqlite',
    );
    this.#config = config;
  }

  async restore() {
    for (const watch of this.#store.list()) {
      await this.start(watch);
    }
  }

  async start(watch: WatchConfig) {
    this.#store.save(watch);
    if (watch.type === 'price') {
      const timer = setInterval(
        async () => {
          const pair = watch.target;
          const [symbol] = pair.split('/');
          const response = await fetch(
            `https://api.binance.us/api/v3/ticker/price?symbol=${symbol}USDT`,
          );
          if (!response.ok) {
            return;
          }
          const payload = (await response.json()) as { price?: string };
          const price = Number(payload.price ?? '0');
          const threshold = Number(
            watch.conditions?.minValue ?? watch.conditions?.maxValue ?? '0',
          );
          const shouldTrigger =
            watch.conditions?.minValue != null
              ? price >= threshold
              : price <= threshold;
          if (shouldTrigger) {
            await this.trigger(watch, {
              type: 'price_change',
              target: pair,
              price,
              timestamp: Date.now(),
            });
          }
        },
        (this.#config.pollInterval ?? 30) * 1000,
      );
      this.#timers.set(watch.id, timer);
    }
  }

  async trigger(watch: WatchConfig, data: Record<string, unknown>) {
    if (watch.callback.type === 'tool_call') {
      const callback = watch.callback.config as {
        toolId: string;
        params?: Record<string, unknown>;
      };
      await this.#runtime.invokeTool(
        callback.toolId,
        {
          sessionId: `watch:${watch.id}`,
          chainId: this.#runtime.config.chain.id,
          runtime: this.#runtime,
          metadata: { watchId: watch.id, chainEvent: data },
        },
        { ...callback.params, event: data },
      );
    }
  }

  stop(id: string) {
    const timer = this.#timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.#timers.delete(id);
    }
    this.#store.delete(id);
  }
}

let service: ChainEventsService | undefined;

export function createChainEventsPlugin(
  config: Partial<ChainEventsConfig> = {},
): CocoPlugin {
  const commonCallback = z.object({
    type: z.enum(['tool_call', 'webhook', 'alert']),
    config: z.unknown(),
  });
  const addressSchema = z.object({
    address: z.string(),
    minValue: z.string().optional(),
    direction: z.enum(['in', 'out', 'both']).optional(),
    onTrigger: commonCallback,
  });
  const contractSchema = z.object({
    contract: z.string(),
    events: z.array(z.string()),
    abi: z.array(z.unknown()).optional(),
    onTrigger: commonCallback,
  });
  const tokenSchema = z.object({
    token: z.string(),
    minAmount: z.string().optional(),
    holders: z.array(z.string()).optional(),
    onTrigger: commonCallback,
  });
  const priceSchema = z.object({
    pair: z.string(),
    above: z.string().optional(),
    below: z.string().optional(),
    changePercent: z.number().optional(),
    interval: z.number().optional(),
    onTrigger: commonCallback,
  });
  const stopSchema = z.object({
    watchId: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'chain-events.watch-address',
      triggers: ['watch', 'address'],
      description: 'Register an address watch.',
      schema: addressSchema,
      async execute(_ctx, params: z.infer<typeof addressSchema>) {
        const watch: WatchConfig = {
          id: randomUUID(),
          type: 'address',
          target: params.address,
          conditions: {
            minValue: params.minValue,
            direction: params.direction,
          },
          callback: {
            type: params.onTrigger.type,
            config: params.onTrigger.config,
          },
        };
        await service?.start(watch);
        return { success: true, data: watch };
      },
    },
    {
      id: 'chain-events.watch-contract',
      triggers: ['watch', 'contract'],
      description: 'Register a contract event watch.',
      schema: contractSchema,
      async execute(_ctx, params: z.infer<typeof contractSchema>) {
        const watch: WatchConfig = {
          id: randomUUID(),
          type: 'contract',
          target: params.contract,
          events: params.events,
          callback: {
            type: params.onTrigger.type,
            config: params.onTrigger.config,
          },
        };
        await service?.start(watch);
        return { success: true, data: watch };
      },
    },
    {
      id: 'chain-events.watch-token',
      triggers: ['watch', 'token'],
      description: 'Register a token transfer watch.',
      schema: tokenSchema,
      async execute(_ctx, params: z.infer<typeof tokenSchema>) {
        const watch: WatchConfig = {
          id: randomUUID(),
          type: 'token',
          target: params.token,
          conditions: {
            minValue: params.minAmount,
          },
          callback: {
            type: params.onTrigger.type,
            config: params.onTrigger.config,
          },
        };
        await service?.start(watch);
        return { success: true, data: watch };
      },
    },
    {
      id: 'chain-events.watch-price',
      triggers: ['watch', 'price'],
      description: 'Register a price watch.',
      schema: priceSchema,
      async execute(_ctx, params: z.infer<typeof priceSchema>) {
        const watch: WatchConfig = {
          id: randomUUID(),
          type: 'price',
          target: params.pair,
          conditions: {
            minValue: params.above,
            maxValue: params.below,
          },
          callback: {
            type: params.onTrigger.type,
            config: params.onTrigger.config,
          },
        };
        await service?.start(watch);
        return { success: true, data: watch };
      },
    },
    {
      id: 'chain-events.stop-watch',
      triggers: ['watch', 'stop'],
      description: 'Stop a registered watch.',
      schema: stopSchema,
      async execute(_ctx, params: z.infer<typeof stopSchema>) {
        service?.stop(params.watchId);
        return { success: true, data: { watchId: params.watchId } };
      },
    },
  ];

  return {
    id: 'chain-events',
    name: 'Coco Chain Events',
    version: '1.2.0',
    description: 'On-chain and price watcher registrations',
    async setup(runtime) {
      service = new ChainEventsService(runtime, {
        rpcUrl: config.rpcUrl ?? runtime.config.chain.rpcUrl,
        pollInterval: config.pollInterval,
        confirmations: config.confirmations,
        storagePath: config.storagePath,
        wsUrl: config.wsUrl,
      });
      await service.restore();
    },
    async teardown() {
      service = undefined;
    },
    tools,
  };
}

export const chainEventsPlugin = createChainEventsPlugin();

export default chainEventsPlugin;
