import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
  LLMToolDefinition,
} from '../types.js';

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string | undefined;
  model: string;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
}

export interface ProviderDependencies {
  fetchImpl?: typeof globalThis.fetch | undefined;
}

export type ToolChunkStream = AsyncGenerator<string | LLMToolCall>;

export interface NormalizedProvider extends LLMProvider {
  chat: (
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ) => Promise<LLMMessage>;
  chatStream: (
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
  ) => ToolChunkStream;
}
