import type { CocoPlugin, CocoTool } from '@coco/core';
import { Contract, JsonRpcProvider } from 'ethers';
import { z } from 'zod';

export interface NFTConfig {
  metadataProvider?: 'ipfs' | 'http' | undefined;
  ipfsGateway?: string | undefined;
}

const ERC721_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function approve(address to, uint256 tokenId)',
];

const ERC1155_ABI = [
  'function uri(uint256 tokenId) view returns (string)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
];

class NFTService {
  readonly #provider: JsonRpcProvider;
  readonly #config: NFTConfig;

  constructor(rpcUrl: string, config: NFTConfig) {
    this.#provider = new JsonRpcProvider(rpcUrl);
    this.#config = config;
  }

  async metadata(uri: string) {
    const resolved =
      uri.startsWith('ipfs://') && this.#config.ipfsGateway
        ? `${this.#config.ipfsGateway.replace(/\/$/, '')}/${uri.slice('ipfs://'.length)}`
        : uri;
    const response = await fetch(resolved);
    if (!response.ok) {
      return undefined;
    }
    return (await response.json()) as Record<string, unknown>;
  }

  erc721(contract: string) {
    return new Contract(contract, ERC721_ABI, this.#provider) as Contract & {
      tokenURI: (tokenId: bigint) => Promise<string>;
      ownerOf: (tokenId: bigint) => Promise<string>;
    };
  }
}

let nftService = new NFTService('https://bsc-dataseed.binance.org', {});

export function createNFTPlugin(config: NFTConfig = {}): CocoPlugin {
  const listSchema = z.object({
    owner: z.string(),
    contract: z.string().optional(),
  });
  const detailSchema = z.object({
    contract: z.string(),
    tokenId: z.string(),
  });
  const transferSchema = z.object({
    contract: z.string(),
    tokenId: z.string(),
    to: z.string(),
  });
  const approveSchema = z.object({
    contract: z.string(),
    tokenId: z.string(),
    spender: z.string(),
  });
  const mintSchema = z.object({
    contract: z.string(),
    to: z.string(),
    tokenURI: z.string().optional(),
    amount: z.number().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'nft.get-nfts',
      triggers: ['nft', 'list'],
      description: 'List NFTs for an owner.',
      schema: listSchema,
      async execute(_ctx, params: z.infer<typeof listSchema>) {
        return {
          success: true,
          data: {
            owner: params.owner,
            contract: params.contract ?? null,
            note: 'Use token indexing or get-nft-detail for exact holdings on a specific contract.',
          },
        };
      },
    },
    {
      id: 'nft.get-nft-detail',
      triggers: ['nft', 'detail'],
      description: 'Get NFT metadata and owner details.',
      schema: detailSchema,
      async execute(_ctx, params: z.infer<typeof detailSchema>) {
        const contract = nftService.erc721(params.contract);
        const tokenUri = await contract.tokenURI(BigInt(params.tokenId));
        const owner = await contract.ownerOf(BigInt(params.tokenId));
        return {
          success: true,
          data: {
            contract: params.contract,
            tokenId: params.tokenId,
            owner,
            tokenURI: tokenUri,
            metadata: await nftService.metadata(tokenUri),
          },
        };
      },
    },
    {
      id: 'nft.transfer-nft',
      triggers: ['nft', 'transfer'],
      description: 'Transfer an ERC721 NFT.',
      schema: transferSchema,
      requiresConfirmation: true,
      async execute(ctx, params: z.infer<typeof transferSchema>) {
        const executionAddress = await ctx.runtime.getExecutionAddress(ctx);
        if (!executionAddress) {
          return {
            success: false,
            error: 'Wallet address is required.',
            code: 'wallet_address_missing',
          };
        }
        const data = nftService
          .erc721(params.contract)
          .interface.encodeFunctionData('safeTransferFrom', [
            executionAddress,
            params.to,
            BigInt(params.tokenId),
          ]);
        return await ctx.runtime.executeTransaction({
          operation: 'transfer',
          toolId: 'nft.transfer-nft',
          ctx,
          tx: { to: params.contract, data },
          amountUsd: 0,
          description: `Transfer NFT ${params.tokenId} to ${params.to}`,
        });
      },
    },
    {
      id: 'nft.approve-nft',
      triggers: ['nft', 'approve'],
      description: 'Approve an ERC721 NFT.',
      schema: approveSchema,
      requiresConfirmation: true,
      async execute(ctx, params: z.infer<typeof approveSchema>) {
        const data = nftService
          .erc721(params.contract)
          .interface.encodeFunctionData('approve', [
            params.spender,
            BigInt(params.tokenId),
          ]);
        return await ctx.runtime.executeTransaction({
          operation: 'transfer',
          toolId: 'nft.approve-nft',
          ctx,
          tx: { to: params.contract, data },
          amountUsd: 0,
          description: `Approve NFT ${params.tokenId} for ${params.spender}`,
        });
      },
    },
    {
      id: 'nft.mint-nft',
      triggers: ['nft', 'mint'],
      description: 'Prepare a generic NFT mint transaction.',
      schema: mintSchema,
      requiresConfirmation: true,
      async execute(ctx, params: z.infer<typeof mintSchema>) {
        return await ctx.runtime.executeTransaction({
          operation: 'transfer',
          toolId: 'nft.mint-nft',
          ctx,
          tx: {
            to: params.contract,
            data: '0x',
          },
          amountUsd: 0,
          description: `Mint NFT to ${params.to}`,
        });
      },
    },
  ];

  return {
    id: 'nft',
    name: 'Coco NFT',
    version: '1.2.0',
    description: 'NFT detail, transfer, approval, and mint flows',
    async setup(runtime) {
      nftService = new NFTService(runtime.config.chain.rpcUrl, config);
    },
    tools,
  };
}

export const nftPlugin = createNFTPlugin();

export default nftPlugin;
