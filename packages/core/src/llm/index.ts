import type {
  CocoRuntimeConfig,
  LLMProvider,
  RuntimeDependencies,
} from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compat.js';
import { createVllmProvider } from './vllm.js';

export function createLLMProvider(
  config: CocoRuntimeConfig['llm'],
  dependencies: RuntimeDependencies = {},
): LLMProvider {
  const providerConfig = {
    baseUrl: config.baseUrl.replace(/\/$/, ''),
    apiKey: config.apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  };

  if (config.provider === 'anthropic') {
    return new AnthropicProvider(providerConfig, {
      fetchImpl: dependencies.fetch,
    });
  }

  if (config.provider === 'vllm') {
    return createVllmProvider(providerConfig, {
      fetchImpl: dependencies.fetch,
    });
  }

  return new OpenAICompatibleProvider(providerConfig, {
    fetchImpl: dependencies.fetch,
  });
}
