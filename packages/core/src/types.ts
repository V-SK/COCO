import type { Logger } from 'pino';
import type { z } from 'zod';

export type UUID = string;
export type WalletMode = 'unsigned' | 'delegated' | 'session-key' | 'custodial';
export type WalletPermission = 'swap' | 'transfer';
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
export type SqlQueryMode = 'readonly' | 'readwrite';

export interface WalletLimits {
  perTxUsd: number;
  dailyUsd: number;
  requireConfirmAbove?: number | undefined;
}

export interface SessionKeyConfig {
  signer: string;
  validUntil: number;
  permissions: WalletPermission[];
}

export interface WalletConfig {
  mode: WalletMode;
  privateKey?: string | undefined;
  limits?: WalletLimits | undefined;
  sessionKey?: SessionKeyConfig | undefined;
}

export interface CocoRuntimeConfig {
  llm: {
    provider: 'vllm' | 'openai' | 'anthropic' | 'ollama';
    baseUrl: string;
    apiKey?: string | undefined;
    model: string;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
  };
  chain: {
    id: number;
    rpcUrl: string;
  };
  wallet?: WalletConfig | undefined;
  systemPrompt?: string | undefined;
}

export type ResolvedCocoRuntimeConfig = Omit<CocoRuntimeConfig, 'wallet'> & {
  wallet: WalletConfig;
};

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LLMMessage {
  role: ChatRole;
  content: string;
  toolCallId?: string | undefined;
  toolCalls?: LLMToolCall[] | undefined;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMProvider {
  model: string;
  chat: (
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ) => Promise<LLMMessage>;
  chatStream: (
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ) => AsyncGenerator<string | LLMToolCall>;
}

export interface ToolResult<TData = unknown> {
  success: boolean;
  data?: TData | undefined;
  error?: string | undefined;
  code?: string | undefined;
  text?: string | undefined;
}

export interface UnsignedTransactionResult {
  type: 'unsigned_tx';
  tx: Record<string, unknown>;
}

export interface SignedTransactionResult {
  type: 'signed_tx';
  txHash: string;
}

export interface ConfirmationRequiredResult {
  type: 'confirmation_required';
  operation: WalletPermission;
  amountUsd: number;
  threshold: number;
  tx: Record<string, unknown>;
}

export interface SessionRecord {
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  sessionId: string;
  userId?: string | undefined;
  type: 'fact' | 'preference' | 'context' | 'conversation';
  content: string;
  embedding?: number[] | undefined;
  importance: number;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
}

export interface MarketSnapshot {
  token: string;
  chainId: number;
  price: string;
  timestamp: number;
  volume24h?: string | undefined;
  liquidityUsd?: number | undefined;
  sentimentScore?: number | undefined;
  source?: string | undefined;
}

export interface TradeIntent {
  token: string;
  side: 'BUY' | 'SELL' | 'HOLD';
  amountUsd?: number | undefined;
  strategy: string;
  confidence: number;
  reason: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface BacktestTrade {
  timestamp: number;
  side: 'BUY' | 'SELL';
  price: number;
  pnl?: number | undefined;
  reason?: string | undefined;
}

export interface BacktestCoverage {
  degraded: boolean;
  price: boolean;
  onchain: boolean;
  news: boolean;
  notes: string[];
}

export interface BacktestResult {
  token: string;
  strategy: string;
  startTime: number;
  endTime: number;
  trades: BacktestTrade[];
  signalCount: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdownPct: number;
  coverage: BacktestCoverage;
}

export interface PositionRecord {
  id: string;
  token: string;
  side: 'LONG' | 'SHORT';
  entryPrice: string;
  currentPrice: string;
  size: string;
  sizeUsd: string;
  pnl: string;
  pnlPct: number;
  stopLoss?: string | undefined;
  takeProfit?: string | undefined;
  strategy: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  closedAt?: number | undefined;
}

export interface RiskConfigSnapshot {
  useDefaultTemplate: boolean;
  resolved: Record<string, number | boolean | null>;
  customConfig?:
    | Record<string, number | boolean | null | undefined>
    | undefined;
}

export interface StrategyRun {
  id: string;
  strategy: string;
  token: string;
  mode: 'paper' | 'live';
  status: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'ERROR';
  startedAt: number;
  updatedAt: number;
  riskConfig: RiskConfigSnapshot;
  metadata?: Record<string, unknown> | undefined;
}

export interface RecallOptions {
  sessionId?: string | undefined;
  userId?: string | undefined;
  type?: MemoryRecord['type'] | undefined;
  limit?: number | undefined;
  minImportance?: number | undefined;
}

export interface MemoryStore {
  getSession: (sessionId: UUID) => Promise<SessionRecord>;
  appendMessages: (sessionId: UUID, messages: LLMMessage[]) => Promise<void>;
  mergeMetadata: (
    sessionId: UUID,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  clearSession: (sessionId: UUID) => Promise<void>;
}

export interface PersistentMemoryStore extends MemoryStore {
  remember: (
    memory: Omit<
      MemoryRecord,
      'id' | 'createdAt' | 'accessedAt' | 'accessCount'
    >,
  ) => Promise<MemoryRecord>;
  recall: (
    query: string,
    options?: RecallOptions | undefined,
  ) => Promise<MemoryRecord[]>;
  forget: (memoryId: string) => Promise<void>;
}

export interface CocoContext {
  sessionId: UUID;
  userId?: string | undefined;
  walletAddress?: string | undefined;
  chainId: number;
  runtime: CocoRuntime;
  metadata: Record<string, unknown>;
}

export interface CocoTool<TParams = unknown> {
  id: string;
  triggers: string[];
  description: string;
  schema?: z.ZodType<TParams, z.ZodTypeDef, unknown> | undefined;
  requiresConfirmation?: boolean | undefined;
  execute(ctx: CocoContext, params: TParams): Promise<ToolResult>;
  validate?(ctx: CocoContext): Promise<boolean>;
}

export interface CocoProvider {
  id: string;
  get: (ctx: CocoContext) => Promise<Record<string, unknown>>;
}

export interface CocoPlugin {
  id: string;
  name: string;
  version: string;
  description?: string | undefined;
  setup: (runtime: CocoRuntime) => Promise<void>;
  teardown?: (() => Promise<void>) | undefined;
  tools?: CocoTool[] | undefined;
  providers?: CocoProvider[] | undefined;
}

export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolId: string; params: unknown }
  | { type: 'tool_result'; toolId: string; result: ToolResult }
  | { type: 'error'; error: string; code?: string | undefined }
  | { type: 'done' };

export interface LimitCheckInput {
  subjectId: string;
  amountUsd: number;
  limits: WalletLimits;
  timestamp?: number | undefined;
}

export interface LimitRecord {
  subjectId: string;
  toolId: string;
  txHash: string;
  amountUsd: number;
  chainId: number;
  mode: WalletMode;
  timestamp?: number | undefined;
}

export interface LimitLedger {
  getDailyTotal: (
    subjectId: string,
    timestamp?: number | undefined,
  ) => Promise<number>;
  ensureWithinLimits: (input: LimitCheckInput) => Promise<void>;
  record: (entry: LimitRecord) => Promise<void>;
  close?: (() => Promise<void>) | undefined;
}

export interface WalletExecutionRequest {
  operation: WalletPermission;
  toolId: string;
  ctx: CocoContext;
  tx: Record<string, unknown>;
  amountUsd?: number | undefined;
  description: string;
}

export interface SessionKeyExecutor {
  execute: (
    request: WalletExecutionRequest,
    privateKey: string,
  ) => Promise<ToolResult>;
}

export interface WalletExecutor {
  execute: (request: WalletExecutionRequest) => Promise<ToolResult>;
  resolveAddress: (ctx: CocoContext) => Promise<string | undefined>;
}

export interface RuntimeDependencies {
  fetch?: typeof globalThis.fetch | undefined;
  memory?: MemoryStore | undefined;
  logger?: Logger | undefined;
  limitLedger?: LimitLedger | undefined;
}

export interface CocoRuntime {
  config: ResolvedCocoRuntimeConfig;
  llm: LLMProvider;
  logger: Logger;
  memory: MemoryStore;
  plugins: Map<string, CocoPlugin>;
  tools: Map<string, CocoTool>;
  providers: Map<string, CocoProvider>;
  limitLedger: LimitLedger;
  registerPlugin: (plugin: CocoPlugin) => Promise<void>;
  unregisterPlugin: (pluginId: string) => Promise<void>;
  invokeTool: (
    toolId: string,
    ctx: CocoContext,
    params: unknown,
  ) => Promise<ToolResult>;
  executeTransaction: (request: WalletExecutionRequest) => Promise<ToolResult>;
  getExecutionAddress: (ctx: CocoContext) => Promise<string | undefined>;
  chat: (ctx: CocoContext, message: string) => AsyncGenerator<ChatEvent>;
  getToolDefinitions: () => LLMToolDefinition[];
}
