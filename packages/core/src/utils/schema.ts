import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function toJsonSchema(
  schema?: z.ZodType<unknown>,
): Record<string, unknown> {
  if (!schema) {
    return { type: 'object', properties: {} };
  }

  return zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}
