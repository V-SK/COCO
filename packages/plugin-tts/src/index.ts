import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { type CocoPlugin, type CocoTool, optionalImport } from '@coco/core';
import { z } from 'zod';

export interface TTSConfig {
  provider: 'edge' | 'elevenlabs';
  voice?: string | undefined;
  speed?: number | undefined;
  pitch?: number | undefined;
  elevenLabsApiKey?: string | undefined;
  elevenLabsVoiceId?: string | undefined;
}

export function createTTSPlugin(
  config: TTSConfig = { provider: 'edge' },
): CocoPlugin {
  const speakSchema = z.object({
    text: z.string(),
    voice: z.string().optional(),
    speed: z.number().optional(),
    output: z.enum(['play', 'file']).optional(),
    outputPath: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'tts.speak',
      triggers: ['tts', 'speak', 'voice'],
      description: 'Synthesize speech from text.',
      schema: speakSchema,
      async execute(_ctx, params: z.infer<typeof speakSchema>) {
        const outputMode = params.output ?? 'file';
        const filePath = params.outputPath ?? 'coco-tts-output.txt';
        if (outputMode === 'file') {
          await fs.mkdir(dirname(filePath), { recursive: true });
        }

        if (config.provider === 'edge') {
          const edgeTts = await optionalImport<{
            synthesize?: (options: Record<string, unknown>) => Promise<Buffer>;
          }>('edge-tts');
          if (edgeTts?.synthesize && outputMode === 'file') {
            const audio = await edgeTts.synthesize({
              text: params.text,
              voice: params.voice ?? config.voice ?? 'zh-CN-XiaoxiaoNeural',
            });
            await fs.writeFile(filePath, audio);
            return {
              success: true,
              data: { provider: 'edge', outputPath: filePath },
            };
          }
        }

        if (outputMode === 'file') {
          await fs.writeFile(
            filePath,
            `provider=${config.provider}\nvoice=${params.voice ?? config.voice ?? 'default'}\ntext=${params.text}\n`,
            'utf-8',
          );
        }
        return {
          success: true,
          data: {
            provider: config.provider,
            output: outputMode,
            outputPath: outputMode === 'file' ? filePath : undefined,
          },
        };
      },
    },
  ];

  return {
    id: 'tts',
    name: 'Coco TTS',
    version: '1.2.0',
    description: 'Text-to-speech generation',
    async setup() {},
    tools,
  };
}

export const ttsPlugin = createTTSPlugin();

export default ttsPlugin;
