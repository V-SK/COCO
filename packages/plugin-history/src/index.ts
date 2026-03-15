import type { CocoPlugin, CocoTool } from '@coco/core';
import { JsonRpcProvider } from 'ethers';
import { z } from 'zod';

export interface HistoryConfig {
  provider: 'bscscan' | 'rpc';
  apiKey?: string | undefined;
  rpcUrl?: string | undefined;
}

class HistoryService {
  readonly #config: HistoryConfig;
  readonly #provider?: JsonRpcProvider;

  constructor(config: HistoryConfig) {
    this.#config = config;
    if (config.provider === 'rpc' && config.rpcUrl) {
      this.#provider = new JsonRpcProvider(config.rpcUrl);
    }
  }

  async getTxDetail(txHash: string) {
    if (this.#config.provider === 'bscscan') {
      const url = new URL('https://api.bscscan.com/api');
      url.searchParams.set('module', 'proxy');
      url.searchParams.set('action', 'eth_getTransactionByHash');
      url.searchParams.set('txhash', txHash);
      if (this.#config.apiKey) {
        url.searchParams.set('apikey', this.#config.apiKey);
      }
      const response = await fetch(url);
      return await response.json();
    }
    return await this.#provider?.getTransaction(txHash);
  }
}

let historyService = new HistoryService({ provider: 'rpc' });

export function createHistoryPlugin(
  config: HistoryConfig = { provider: 'rpc' },
): CocoPlugin {
  const historySchema = z.object({
    address: z.string(),
    page: z.number().optional(),
    limit: z.number().optional(),
    startBlock: z.number().optional(),
    endBlock: z.number().optional(),
  });
  const tokenSchema = z.object({
    address: z.string(),
    token: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  });
  const detailSchema = z.object({
    txHash: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'history.get-tx-history',
      triggers: ['history', 'transactions'],
      description: 'Get transaction history for an address.',
      schema: historySchema,
      async execute(_ctx, params: z.infer<typeof historySchema>) {
        if (config.provider === 'bscscan') {
          const url = new URL('https://api.bscscan.com/api');
          url.searchParams.set('module', 'account');
          url.searchParams.set('action', 'txlist');
          url.searchParams.set('address', params.address);
          url.searchParams.set('page', String(params.page ?? 1));
          url.searchParams.set('offset', String(params.limit ?? 10));
          url.searchParams.set('startblock', String(params.startBlock ?? 0));
          url.searchParams.set('endblock', String(params.endBlock ?? 99999999));
          if (config.apiKey) {
            url.searchParams.set('apikey', config.apiKey);
          }
          const response = await fetch(url);
          return { success: true, data: await response.json() };
        }

        return {
          success: true,
          data: {
            address: params.address,
            provider: 'rpc',
            note: 'RPC history requires an indexer; use get-tx-detail for direct hash lookups.',
          },
        };
      },
    },
    {
      id: 'history.get-token-txs',
      triggers: ['history', 'token', 'transfers'],
      description: 'Get token transfer history for an address.',
      schema: tokenSchema,
      async execute(_ctx, params: z.infer<typeof tokenSchema>) {
        const url = new URL('https://api.bscscan.com/api');
        url.searchParams.set('module', 'account');
        url.searchParams.set('action', 'tokentx');
        url.searchParams.set('address', params.address);
        url.searchParams.set('page', String(params.page ?? 1));
        url.searchParams.set('offset', String(params.limit ?? 10));
        if (params.token) {
          url.searchParams.set('contractaddress', params.token);
        }
        if (config.apiKey) {
          url.searchParams.set('apikey', config.apiKey);
        }
        const response = await fetch(url);
        return { success: true, data: await response.json() };
      },
    },
    {
      id: 'history.get-tx-detail',
      triggers: ['history', 'transaction', 'detail'],
      description: 'Get details for a specific transaction hash.',
      schema: detailSchema,
      async execute(_ctx, params: z.infer<typeof detailSchema>) {
        return {
          success: true,
          data: await historyService.getTxDetail(params.txHash),
        };
      },
    },
  ];

  return {
    id: 'history',
    name: 'Coco History',
    version: '1.2.0',
    description: 'Transaction and transfer history lookups',
    async setup(runtime) {
      historyService = new HistoryService({
        ...config,
        rpcUrl: config.rpcUrl ?? runtime.config.chain.rpcUrl,
      });
    },
    tools,
  };
}

export const historyPlugin = createHistoryPlugin();

export default historyPlugin;
