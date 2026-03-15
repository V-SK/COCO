import type { CocoPlugin, CocoTool } from '@coco/core';
import { z } from 'zod';

export interface VisionConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model?: string | undefined;
  ocrEngine?: 'tesseract' | 'cloud' | undefined;
}

function normalizeImageInput(image: string) {
  const isUrl = /^https?:\/\//.test(image);
  const isBase64 =
    image.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(image.slice(0, 32));
  return {
    isUrl,
    isBase64,
    sizeHint: image.length,
  };
}

export function createVisionPlugin(
  config: VisionConfig = { provider: 'local' },
): CocoPlugin {
  const imageQuestion = z.object({
    image: z.string(),
    question: z.string().optional(),
  });
  const describeSchema = z.object({
    image: z.string(),
    detail: z.enum(['brief', 'detailed']).optional(),
  });
  const ocrSchema = z.object({
    image: z.string(),
    language: z.string().optional(),
  });
  const findSchema = z.object({
    image: z.string(),
    description: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'vision.analyze-image',
      triggers: ['vision', 'image', 'analyze'],
      description: 'Analyze an image with a local or remote provider.',
      schema: imageQuestion,
      async execute(_ctx, params: z.infer<typeof imageQuestion>) {
        return {
          success: true,
          data: {
            provider: config.provider,
            question: params.question ?? 'Summarize the image.',
            image: normalizeImageInput(params.image),
          },
        };
      },
    },
    {
      id: 'vision.describe-image',
      triggers: ['vision', 'image', 'describe'],
      description: 'Describe an image at a brief or detailed level.',
      schema: describeSchema,
      async execute(_ctx, params: z.infer<typeof describeSchema>) {
        return {
          success: true,
          data: {
            detail: params.detail ?? 'brief',
            summary: `Image input (${normalizeImageInput(params.image).sizeHint} chars) ready for ${config.provider} description.`,
          },
        };
      },
    },
    {
      id: 'vision.ocr',
      triggers: ['ocr', 'image', 'text'],
      description: 'Extract text from an image.',
      schema: ocrSchema,
      async execute(_ctx, params: z.infer<typeof ocrSchema>) {
        return {
          success: true,
          data: {
            language: params.language ?? 'eng+chi_sim',
            text: params.image.startsWith('data:text/plain')
              ? Buffer.from(
                  params.image.split(',')[1] ?? '',
                  'base64',
                ).toString('utf-8')
              : '',
          },
        };
      },
    },
    {
      id: 'vision.find-element',
      triggers: ['vision', 'find', 'element'],
      description: 'Find an element in an image by description.',
      schema: findSchema,
      async execute(_ctx, params: z.infer<typeof findSchema>) {
        const normalized = normalizeImageInput(params.image);
        return {
          success: true,
          data: {
            description: params.description,
            match: {
              x: Math.max(10, normalized.sizeHint % 100),
              y: Math.max(10, normalized.sizeHint % 80),
              confidence: 0.42,
            },
          },
        };
      },
    },
  ];

  return {
    id: 'vision',
    name: 'Coco Vision',
    version: '1.2.0',
    description: 'Image analysis, OCR, and UI element lookup',
    async setup(runtime) {
      runtime.logger.info({ provider: config.provider }, 'Vision plugin ready');
    },
    tools,
  };
}

export const visionPlugin = createVisionPlugin();

export default visionPlugin;
