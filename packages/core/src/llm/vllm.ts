import type { LLMProvider } from '../types.js';
import type { ProviderConfig, ProviderDependencies } from './interface.js';
import { OpenAICompatibleProvider } from './openai-compat.js';

export function createVllmProvider(
  config: ProviderConfig,
  dependencies: ProviderDependencies = {},
): LLMProvider {
  return new OpenAICompatibleProvider(config, dependencies);
}
