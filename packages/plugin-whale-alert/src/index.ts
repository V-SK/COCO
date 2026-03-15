import { randomUUID } from 'node:crypto';
import {
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
} from '@coco/core';
import { z } from 'zod';

const CEX_WALLETS = {
  binance: [
    '0x28c6c06298d514db089934071355e5743bf21d60',
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
  ],
  coinbase: ['0x503828976d22510aad0201ac7ec88293211d23da'],
  okx: ['0x1b1c7c31f011fc7f22b6f4b3f690e2e8fcf61b2a'],
} as const;

export interface WhaleAlert {
  id: string;
  type: 'WALLET' | 'TOKEN' | 'CEX';
  walletAddress?: string | undefined;
  tokenAddress?: string | undefined;
  minAmountUsd?: number | undefined;
  cex?: 'binance' | 'coinbase' | 'okx' | undefined;
  notifyChannels: ('telegram' | 'discord' | 'webhook')[];
}

export interface WhaleMove {
  id: string;
  timestamp: number;
  txHash: string;
  type: 'ACCUMULATE' | 'DISTRIBUTE' | 'CEX_DEPOSIT' | 'CEX_WITHDRAW' | 'SWAP';
  wallet: string;
  walletLabel?: string | undefined;
  token: string;
  amount: string;
  valueUsd: string;
  significance: 'HIGH' | 'MEDIUM' | 'LOW';
  interpretation?: string | undefined;
}

export interface WhaleAlertConfig {
  storagePath?: string | undefined;
  bscScanApiKey?: string | undefined;
}

async function interpretMove(
  ctx: CocoContext,
  move: WhaleMove,
): Promise<string> {
  try {
    const response = await ctx.runtime.llm.chat([
      {
        role: 'system',
        content:
          'Interpret the whale move in one sentence using only the structured event data.',
      },
      {
        role: 'user',
        content: JSON.stringify(move),
      },
    ]);
    return (
      response.content.trim() || `${move.type} detected for ${move.token}.`
    );
  } catch {
    return `${move.type} detected for ${move.token} with value ${move.valueUsd}.`;
  }
}

class WhaleAlertService {
  readonly #store: SqliteStructuredStore;
  readonly #apiKey: string | undefined;

  constructor(config: WhaleAlertConfig) {
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-whale-alert.sqlite',
    );
    this.#apiKey = config.bscScanApiKey;
  }

  close() {
    this.#store.close();
  }

  addAlert(alert: WhaleAlert) {
    this.#store.save('whale-alerts', alert.id, alert);
    return alert;
  }

  removeAlert(id: string) {
    this.#store.delete('whale-alerts', id);
  }

  listAlerts() {
    return this.#store.list<WhaleAlert>('whale-alerts');
  }

  async getMoves(
    ctx: CocoContext,
    token?: string | undefined,
    minValueUsd = 100_000,
    hours = 24,
  ): Promise<WhaleMove[]> {
    const url = new URL('https://api.bscscan.com/api');
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', token ? 'tokentx' : 'txlist');
    if (token) {
      url.searchParams.set('contractaddress', token);
    }
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', '50');
    if (this.#apiKey) {
      url.searchParams.set('apikey', this.#apiKey);
    }
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as {
      result?: Array<{
        hash?: string;
        timeStamp?: string;
        from?: string;
        to?: string;
        tokenSymbol?: string;
        value?: string;
        input?: string;
      }>;
    };
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const moves = await Promise.all(
      (payload.result ?? [])
        .filter((entry) => Number(entry.timeStamp ?? '0') * 1000 >= cutoff)
        .map(async (entry) => {
          const valueUsd = Number(entry.value ?? '0');
          if (valueUsd < minValueUsd) {
            return undefined;
          }
          const from = entry.from?.toLowerCase() ?? '';
          const to = entry.to?.toLowerCase() ?? '';
          const cexEntry = Object.entries(CEX_WALLETS).find(([, addresses]) =>
            addresses.some((address) => address === from || address === to),
          );
          const type: WhaleMove['type'] = cexEntry
            ? cexEntry[1].some((address) => address === from)
              ? 'CEX_WITHDRAW'
              : 'CEX_DEPOSIT'
            : entry.input && entry.input !== '0x'
              ? 'SWAP'
              : valueUsd >= 500_000
                ? 'ACCUMULATE'
                : 'DISTRIBUTE';
          const move: WhaleMove = {
            id: randomUUID(),
            timestamp:
              Number(entry.timeStamp ?? `${Math.floor(Date.now() / 1000)}`) *
              1000,
            txHash: entry.hash ?? randomUUID(),
            type,
            wallet: entry.from ?? 'unknown',
            token:
              entry.tokenSymbol?.toUpperCase() ?? token?.toUpperCase() ?? 'BNB',
            amount: entry.value ?? '0',
            valueUsd: String(valueUsd),
            significance:
              valueUsd >= 1_000_000
                ? 'HIGH'
                : valueUsd >= 250_000
                  ? 'MEDIUM'
                  : 'LOW',
          };
          move.interpretation = await interpretMove(ctx, move);
          this.#store.save('whale-moves', move.id, move);
          return move;
        }),
    );
    return moves.filter((value): value is WhaleMove => Boolean(value));
  }
}

let whaleAlertService = new WhaleAlertService({});

export function createWhaleAlertPlugin(
  config: WhaleAlertConfig = {},
): CocoPlugin {
  const addSchema = z.object({
    type: z.enum(['WALLET', 'TOKEN', 'CEX']),
    config: z.object({
      walletAddress: z.string().optional(),
      tokenAddress: z.string().optional(),
      minAmountUsd: z.number().optional(),
      cex: z.enum(['binance', 'coinbase', 'okx']).optional(),
      notifyChannels: z
        .array(z.enum(['telegram', 'discord', 'webhook']))
        .default(['webhook']),
    }),
  });
  const removeSchema = z.object({
    alertId: z.string(),
  });
  const movesSchema = z.object({
    token: z.string().optional(),
    minValueUsd: z.number().optional(),
    hours: z.number().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'whale-alert.add-alert',
      triggers: ['whale', 'alert', 'add'],
      description: 'Add a whale monitoring rule.',
      schema: addSchema,
      async execute(_ctx, params: z.infer<typeof addSchema>) {
        const alert: WhaleAlert = {
          id: randomUUID(),
          type: params.type,
          walletAddress: params.config.walletAddress,
          tokenAddress: params.config.tokenAddress,
          minAmountUsd: params.config.minAmountUsd,
          cex: params.config.cex,
          notifyChannels: params.config.notifyChannels,
        };
        return { success: true, data: whaleAlertService.addAlert(alert) };
      },
    },
    {
      id: 'whale-alert.remove-alert',
      triggers: ['whale', 'alert', 'remove'],
      description: 'Remove a whale monitoring rule.',
      schema: removeSchema,
      async execute(_ctx, params: z.infer<typeof removeSchema>) {
        whaleAlertService.removeAlert(params.alertId);
        return { success: true, data: { alertId: params.alertId } };
      },
    },
    {
      id: 'whale-alert.list-alerts',
      triggers: ['whale', 'alert', 'list'],
      description: 'List whale monitoring rules.',
      async execute() {
        return { success: true, data: whaleAlertService.listAlerts() };
      },
    },
    {
      id: 'whale-alert.get-whale-moves',
      triggers: ['whale', 'moves'],
      description: 'Fetch classified whale movement data.',
      schema: movesSchema,
      async execute(ctx, params: z.infer<typeof movesSchema>) {
        return {
          success: true,
          data: await whaleAlertService.getMoves(
            ctx,
            params.token,
            params.minValueUsd ?? 100_000,
            params.hours ?? 24,
          ),
        };
      },
    },
  ];

  return {
    id: 'whale-alert',
    name: 'Coco Whale Alert',
    version: '1.2.0',
    description: 'Wallet, token, and CEX whale flow monitoring',
    async setup() {
      whaleAlertService = new WhaleAlertService(config);
    },
    async teardown() {
      whaleAlertService.close();
    },
    tools,
  };
}

export const whaleAlertPlugin = createWhaleAlertPlugin();

export default whaleAlertPlugin;
