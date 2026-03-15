export { OllamaProvider } from '@coco/core';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  options?: {
    temperature?: number | undefined;
    numCtx?: number | undefined;
    numGpu?: number | undefined;
  };
}

export async function checkOllamaModel(
  baseUrl: string,
  model: string,
): Promise<{ exists: boolean; supportsTools: boolean }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
  if (!response.ok) {
    return { exists: false, supportsTools: false };
  }

  const payload = (await response.json()) as {
    models?: Array<{ name?: string; details?: { families?: string[] } }>;
  };
  const entry = payload.models?.find((item) => item.name === model);
  return {
    exists: Boolean(entry),
    supportsTools: entry?.details?.families?.includes('tools') ?? false,
  };
}
