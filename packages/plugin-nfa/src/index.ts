import type { CocoPlugin, CocoTool, ToolResult } from '@coco/core';
import { CocoError } from '@coco/core';
import type { InterfaceAbi } from 'ethers';
import { Contract, JsonRpcProvider } from 'ethers';
import { z } from 'zod';

export interface NFAIdentity {
  tokenId: string;
  owner: string;
  metadata: {
    name: string;
    description: string;
    avatar?: string;
    capabilities: string[];
    trustScore?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface NFAPluginConfig {
  contractAddress?: string | undefined;
  abi?: InterfaceAbi | undefined;
}

const DEFAULT_BAP578_ABI: InterfaceAbi = [
  'function createAgent(string metadata) payable returns (uint256)',
  'function updateAgentMetadata(uint256 tokenId, string metadata)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

class NFAService {
  readonly #provider: JsonRpcProvider;
  readonly #config: NFAPluginConfig;

  constructor(rpcUrl: string, config: NFAPluginConfig) {
    this.#provider = new JsonRpcProvider(rpcUrl);
    this.#config = config;
  }

  get contract() {
    if (!this.#config.contractAddress) {
      throw new CocoError(
        'NFA contract address is not configured.',
        'nfa_contract_missing',
      );
    }

    return new Contract(
      this.#config.contractAddress,
      this.#config.abi ?? DEFAULT_BAP578_ABI,
      this.#provider,
    ) as Contract & {
      ownerOf: (tokenId: bigint) => Promise<string>;
      tokenURI: (tokenId: bigint) => Promise<string>;
    };
  }

  async getIdentity(tokenIdOrAddress: string): Promise<NFAIdentity> {
    if (/^\d+$/.test(tokenIdOrAddress)) {
      const tokenId = tokenIdOrAddress;
      const owner = await this.contract.ownerOf(BigInt(tokenId));
      const tokenUri = await this.contract.tokenURI(BigInt(tokenId));
      const metadata = parseMetadata(tokenUri);
      return {
        tokenId,
        owner,
        metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return {
      tokenId: '0',
      owner: tokenIdOrAddress,
      metadata: {
        name: 'Unresolved NFA owner lookup',
        description:
          'Owner lookup requires an enumerable implementation or indexer.',
        capabilities: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

function parseMetadata(value: string): NFAIdentity['metadata'] {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const metadata: NFAIdentity['metadata'] = {
      name: String(parsed.name ?? parsed.persona ?? 'NFA Agent'),
      description: String(parsed.description ?? parsed.experience ?? ''),
      capabilities: Array.isArray(parsed.capabilities)
        ? parsed.capabilities.map((item) => String(item))
        : [],
    };
    if (parsed.avatar) {
      metadata.avatar = String(parsed.avatar);
    }
    if (typeof parsed.trustScore === 'number') {
      metadata.trustScore = parsed.trustScore;
    }
    return metadata;
  } catch {
    return {
      name: 'NFA Agent',
      description: value,
      capabilities: [],
    };
  }
}

let service = new NFAService('https://bsc-dataseed.binance.org', {});

export function createNFAPlugin(config: NFAPluginConfig = {}): CocoPlugin {
  const mintSchema = z.object({
    name: z.string(),
    description: z.string(),
    avatar: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  });
  const updateSchema = z.object({
    tokenId: z.string(),
    metadata: z.record(z.unknown()),
  });
  const getSchema = z.object({
    tokenIdOrAddress: z.string(),
  });

  const mintIdentityTool: CocoTool<z.infer<typeof mintSchema>> = {
    id: 'nfa.mint-identity',
    triggers: ['nfa', 'identity', 'mint'],
    description: 'Mint a BAP-578 identity transaction.',
    schema: mintSchema,
    requiresConfirmation: true,
    async execute(ctx, params): Promise<ToolResult> {
      if (!config.contractAddress) {
        return {
          success: false,
          error: 'NFA contract address is not configured.',
          code: 'nfa_contract_missing',
        };
      }

      const data = service.contract.interface.encodeFunctionData(
        'createAgent',
        [JSON.stringify(params)],
      );
      return ctx.runtime.executeTransaction({
        operation: 'transfer',
        toolId: 'nfa.mint-identity',
        ctx,
        tx: {
          to: config.contractAddress,
          data,
          value: '0x0',
        },
        amountUsd: 0,
        description: `Mint NFA identity ${params.name}`,
      });
    },
  };

  const updateIdentityTool: CocoTool<z.infer<typeof updateSchema>> = {
    id: 'nfa.update-identity',
    triggers: ['nfa', 'identity', 'update'],
    description: 'Update NFA identity metadata.',
    schema: updateSchema,
    requiresConfirmation: true,
    async execute(ctx, params): Promise<ToolResult> {
      if (!config.contractAddress) {
        return {
          success: false,
          error: 'NFA contract address is not configured.',
          code: 'nfa_contract_missing',
        };
      }

      const data = service.contract.interface.encodeFunctionData(
        'updateAgentMetadata',
        [BigInt(params.tokenId), JSON.stringify(params.metadata)],
      );
      return ctx.runtime.executeTransaction({
        operation: 'transfer',
        toolId: 'nfa.update-identity',
        ctx,
        tx: {
          to: config.contractAddress,
          data,
        },
        amountUsd: 0,
        description: `Update NFA identity ${params.tokenId}`,
      });
    },
  };

  const getIdentityTool: CocoTool<z.infer<typeof getSchema>> = {
    id: 'nfa.get-identity',
    triggers: ['nfa', 'identity', 'profile'],
    description: 'Fetch NFA identity by tokenId or owner address.',
    schema: getSchema,
    async execute(_ctx, params): Promise<ToolResult> {
      return {
        success: true,
        data: await service.getIdentity(params.tokenIdOrAddress),
      };
    },
  };

  return {
    id: 'nfa',
    name: 'Coco NFA',
    version: '1.2.0',
    description: 'BAP-578 non-fungible agent identities',
    async setup(runtime) {
      service = new NFAService(runtime.config.chain.rpcUrl, config);
    },
    tools: [mintIdentityTool, updateIdentityTool, getIdentityTool],
  };
}

export const nfaPlugin = createNFAPlugin();

export default nfaPlugin;
