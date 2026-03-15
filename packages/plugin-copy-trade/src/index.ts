import { randomUUID } from 'node:crypto';
import {
  type CocoContext,
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
} from '@coco/core';
import { z } from 'zod';

const SWAP_METHODS = new Set([
  '0x38ed1739',
  '0x18cbafe5',
  '0x7ff36ab5',
  '0x5c11d795',
]);

export interface CopyConfig {
  enabled: boolean;
  mode: 'paper' | 'live';
  positionMode: 'FIXED' | 'PROPORTIONAL';
  fixedAmountUsd?: number | undefined;
  proportionPct?: number | undefined;
  minTradeUsd: number;
  maxTradeUsd: number;
  tokenWhitelist?: string[] | undefined;
  tokenBlacklist?: string[] | undefined;
  delayMs: number;
  requireConfirmation: boolean;
}

export interface WalletTrade {
  txHash: string;
  timestamp: number;
  type: 'SWAP' | 'TRANSFER' | 'APPROVE' | 'OTHER';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  valueUsd: string;
}

export interface FollowedWallet {
  address: string;
  label?: string | undefined;
  addedAt: number;
  config: CopyConfig;
  stats: {
    tradesTracked: number;
    tradesCopied: number;
    pnlUsd: string;
    winRate: number;
  };
}

export interface CopyTradeConfig {
  storagePath?: string | undefined;
  bscScanApiKey?: string | undefined;
}

type CopyConfigInput = {
  enabled?: boolean | undefined;
  mode?: 'paper' | 'live' | undefined;
  positionMode?: 'FIXED' | 'PROPORTIONAL' | undefined;
  fixedAmountUsd?: number | undefined;
  proportionPct?: number | undefined;
  minTradeUsd?: number | undefined;
  maxTradeUsd?: number | undefined;
  tokenWhitelist?: string[] | undefined;
  tokenBlacklist?: string[] | undefined;
  delayMs?: number | undefined;
  requireConfirmation?: boolean | undefined;
};

const DEFAULT_COPY_CONFIG: CopyConfig = {
  enabled: true,
  mode: 'paper',
  positionMode: 'FIXED',
  fixedAmountUsd: 100,
  proportionPct: 1,
  minTradeUsd: 50,
  maxTradeUsd: 10_000,
  delayMs: 3_000,
  requireConfirmation: true,
};

function classifyTrade(input?: string | undefined): WalletTrade['type'] {
  const selector = input?.slice(0, 10).toLowerCase();
  if (selector && SWAP_METHODS.has(selector)) {
    return 'SWAP';
  }
  if (selector === '0x095ea7b3') {
    return 'APPROVE';
  }
  return input && input !== '0x' ? 'OTHER' : 'TRANSFER';
}

class CopyTradeService {
  readonly #store: SqliteStructuredStore;
  readonly #apiKey: string | undefined;

  constructor(config: CopyTradeConfig) {
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-copy-trade.sqlite',
    );
    this.#apiKey = config.bscScanApiKey;
  }

  close() {
    this.#store.close();
  }

  saveWallet(wallet: FollowedWallet) {
    this.#store.save('followed-wallets', wallet.address.toLowerCase(), wallet);
    return wallet;
  }

  deleteWallet(address: string) {
    this.#store.delete('followed-wallets', address.toLowerCase());
  }

  listWallets() {
    return this.#store.list<FollowedWallet>('followed-wallets');
  }

  async fetchWalletTrades(address: string, limit = 10): Promise<WalletTrade[]> {
    const url = new URL('https://api.bscscan.com/api');
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', address);
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', String(limit));
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
        input?: string;
        value?: string;
        tokenSymbol?: string;
        contractAddress?: string;
        to?: string;
      }>;
    };
    return (payload.result ?? []).map((entry) => ({
      txHash: entry.hash ?? randomUUID(),
      timestamp:
        Number(entry.timeStamp ?? `${Math.floor(Date.now() / 1000)}`) * 1000,
      type: classifyTrade(entry.input),
      tokenIn: entry.tokenSymbol?.toUpperCase() ?? 'BNB',
      tokenOut:
        entry.contractAddress?.toUpperCase() ??
        entry.to?.toUpperCase() ??
        'UNKNOWN',
      amountIn: entry.value ?? '0',
      amountOut: entry.value ?? '0',
      valueUsd: entry.value ?? '0',
    }));
  }

  async syncWallet(ctx: CocoContext, wallet: FollowedWallet) {
    const trades = await this.fetchWalletTrades(wallet.address, 10);
    const copied: Array<Record<string, unknown>> = [];
    for (const trade of trades) {
      if (trade.type !== 'SWAP') {
        continue;
      }
      const tradeValue = Number(trade.valueUsd);
      const tokenOut = trade.tokenOut.toUpperCase();
      if (
        tradeValue < wallet.config.minTradeUsd ||
        tradeValue > wallet.config.maxTradeUsd
      ) {
        continue;
      }
      if (
        wallet.config.tokenWhitelist?.length &&
        !wallet.config.tokenWhitelist.includes(tokenOut)
      ) {
        continue;
      }
      if (wallet.config.tokenBlacklist?.includes(tokenOut)) {
        continue;
      }
      const trust = await ctx.runtime.invokeTool(
        'trust-score.get-trust-score',
        ctx,
        {
          token: tokenOut,
          detailed: false,
        },
      );
      const overall =
        trust.success && trust.data && typeof trust.data === 'object'
          ? Number((trust.data as { overall?: number }).overall ?? 0)
          : 0;
      if (overall > 0 && overall < 40) {
        continue;
      }
      if (wallet.config.delayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(wallet.config.delayMs, 25)),
        );
      }
      const amountUsd =
        wallet.config.positionMode === 'FIXED'
          ? (wallet.config.fixedAmountUsd ??
            DEFAULT_COPY_CONFIG.fixedAmountUsd ??
            100)
          : tradeValue * ((wallet.config.proportionPct ?? 1) / 100);
      const result =
        wallet.config.mode === 'paper'
          ? {
              success: true,
              data: {
                type: 'paper_fill',
                token: tokenOut,
                amountUsd,
              },
            }
          : await ctx.runtime.invokeTool('dex-agg.execute-swap', ctx, {
              fromToken: 'USDT',
              toToken: tokenOut,
              amount: String(amountUsd),
              slippage: 300,
            });
      copied.push({
        txHash: trade.txHash,
        token: tokenOut,
        amountUsd,
        result: result.data ?? result.error,
      });
    }
    const updatedWallet: FollowedWallet = {
      ...wallet,
      stats: {
        tradesTracked: wallet.stats.tradesTracked + trades.length,
        tradesCopied: wallet.stats.tradesCopied + copied.length,
        pnlUsd: wallet.stats.pnlUsd,
        winRate: wallet.stats.winRate,
      },
    };
    this.saveWallet(updatedWallet);
    return {
      wallet: updatedWallet,
      copied,
      scanned: trades.length,
    };
  }
}

let copyTradeService = new CopyTradeService({});

function normalizeCopyConfig(input?: CopyConfigInput | undefined): CopyConfig {
  return {
    enabled: input?.enabled ?? DEFAULT_COPY_CONFIG.enabled,
    mode: input?.mode ?? DEFAULT_COPY_CONFIG.mode,
    positionMode: input?.positionMode ?? DEFAULT_COPY_CONFIG.positionMode,
    fixedAmountUsd: input?.fixedAmountUsd ?? DEFAULT_COPY_CONFIG.fixedAmountUsd,
    proportionPct: input?.proportionPct ?? DEFAULT_COPY_CONFIG.proportionPct,
    minTradeUsd: input?.minTradeUsd ?? DEFAULT_COPY_CONFIG.minTradeUsd,
    maxTradeUsd: input?.maxTradeUsd ?? DEFAULT_COPY_CONFIG.maxTradeUsd,
    tokenWhitelist: input?.tokenWhitelist ?? DEFAULT_COPY_CONFIG.tokenWhitelist,
    tokenBlacklist: input?.tokenBlacklist ?? DEFAULT_COPY_CONFIG.tokenBlacklist,
    delayMs: input?.delayMs ?? DEFAULT_COPY_CONFIG.delayMs,
    requireConfirmation:
      input?.requireConfirmation ?? DEFAULT_COPY_CONFIG.requireConfirmation,
  };
}

export function createCopyTradePlugin(
  config: CopyTradeConfig = {},
): CocoPlugin {
  const configSchema = z.object({
    enabled: z.boolean().optional(),
    mode: z.enum(['paper', 'live']).optional(),
    positionMode: z.enum(['FIXED', 'PROPORTIONAL']).optional(),
    fixedAmountUsd: z.number().optional(),
    proportionPct: z.number().optional(),
    minTradeUsd: z.number().optional(),
    maxTradeUsd: z.number().optional(),
    tokenWhitelist: z.array(z.string()).optional(),
    tokenBlacklist: z.array(z.string()).optional(),
    delayMs: z.number().optional(),
    requireConfirmation: z.boolean().optional(),
  });
  const followSchema = z.object({
    address: z.string(),
    label: z.string().optional(),
    config: configSchema.optional(),
  });
  const addressSchema = z.object({
    address: z.string(),
  });
  const tradesSchema = z.object({
    address: z.string(),
    limit: z.number().optional(),
  });
  const setConfigSchema = z.object({
    address: z.string(),
    config: configSchema,
  });
  const syncSchema = z.object({
    address: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'copy-trade.follow-wallet',
      triggers: ['copy', 'follow', 'wallet'],
      description: 'Add a wallet to the confirmed-trade copy list.',
      schema: followSchema,
      async execute(_ctx, params: z.infer<typeof followSchema>) {
        const record: FollowedWallet = {
          address: params.address,
          label: params.label,
          addedAt: Date.now(),
          config: normalizeCopyConfig(params.config),
          stats: {
            tradesTracked: 0,
            tradesCopied: 0,
            pnlUsd: '0',
            winRate: 0,
          },
        };
        return {
          success: true,
          data: copyTradeService.saveWallet(record),
        };
      },
    },
    {
      id: 'copy-trade.unfollow-wallet',
      triggers: ['copy', 'unfollow', 'wallet'],
      description: 'Remove a wallet from the copy trading list.',
      schema: addressSchema,
      async execute(_ctx, params: z.infer<typeof addressSchema>) {
        copyTradeService.deleteWallet(params.address);
        return { success: true, data: { address: params.address } };
      },
    },
    {
      id: 'copy-trade.list-followed',
      triggers: ['copy', 'list', 'wallets'],
      description: 'List all followed wallets and copy configs.',
      async execute() {
        return {
          success: true,
          data: copyTradeService.listWallets(),
        };
      },
    },
    {
      id: 'copy-trade.get-wallet-trades',
      triggers: ['copy', 'wallet', 'trades'],
      description:
        'Fetch recent confirmed on-chain trades for a tracked wallet.',
      schema: tradesSchema,
      async execute(_ctx, params: z.infer<typeof tradesSchema>) {
        return {
          success: true,
          data: await copyTradeService.fetchWalletTrades(
            params.address,
            params.limit ?? 10,
          ),
        };
      },
    },
    {
      id: 'copy-trade.set-copy-config',
      triggers: ['copy', 'config'],
      description: 'Update copy trading configuration for a followed wallet.',
      schema: setConfigSchema,
      async execute(_ctx, params: z.infer<typeof setConfigSchema>) {
        const current = copyTradeService
          .listWallets()
          .find(
            (wallet) =>
              wallet.address.toLowerCase() === params.address.toLowerCase(),
          );
        if (!current) {
          return {
            success: false,
            error: 'Wallet not found in follow list.',
            code: 'copy_trade_wallet_not_found',
          };
        }
        const updated = copyTradeService.saveWallet({
          ...current,
          config: normalizeCopyConfig({
            ...current.config,
            ...params.config,
          }),
        });
        return { success: true, data: updated };
      },
    },
    {
      id: 'copy-trade.sync-followed',
      triggers: ['copy', 'sync'],
      description:
        'Synchronize followed wallets and process newly confirmed swap trades.',
      schema: syncSchema,
      async execute(ctx, params: z.infer<typeof syncSchema>) {
        const wallets = copyTradeService
          .listWallets()
          .filter((wallet) =>
            params.address
              ? wallet.address.toLowerCase() === params.address.toLowerCase()
              : true,
          );
        const results = await Promise.all(
          wallets.map(
            async (wallet) => await copyTradeService.syncWallet(ctx, wallet),
          ),
        );
        return { success: true, data: results };
      },
    },
  ];

  return {
    id: 'copy-trade',
    name: 'Coco Copy Trade',
    version: '1.2.0',
    description: 'Confirmed-chain copy trading with trust score filters',
    async setup() {
      copyTradeService = new CopyTradeService(config);
    },
    async teardown() {
      copyTradeService.close();
    },
    tools,
  };
}

export const copyTradePlugin = createCopyTradePlugin();

export default copyTradePlugin;
