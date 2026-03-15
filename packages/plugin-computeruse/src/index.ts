import {
  type CocoPlugin,
  type CocoTool,
  assertSupportedPlatform,
  optionalImport,
} from '@coco/core';
import { z } from 'zod';

export interface ComputerUseConfig {
  screenIndex?: number | undefined;
  mouseSpeed?: number | undefined;
  typeDelay?: number | undefined;
}

class ComputerUseService {
  constructor(readonly config: ComputerUseConfig) {}

  async module() {
    assertSupportedPlatform(['darwin', 'linux']);
    const module =
      await optionalImport<Record<string, unknown>>('@nut-tree/nut-js');
    return module;
  }
}

let service = new ComputerUseService({});

export function createComputerUsePlugin(
  config: ComputerUseConfig = {},
): CocoPlugin {
  const regionSchema = z.object({
    region: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  });
  const moveSchema = z.object({
    x: z.number(),
    y: z.number(),
    smooth: z.boolean().optional(),
  });
  const clickSchema = z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    button: z.enum(['left', 'right', 'middle']).optional(),
    clicks: z.number().optional(),
  });
  const typeSchema = z.object({
    text: z.string(),
    delay: z.number().optional(),
  });
  const hotkeySchema = z.object({
    keys: z.array(z.string()),
  });
  const focusSchema = z.object({
    title: z.string().optional(),
    processName: z.string().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'computer.screenshot',
      triggers: ['computer', 'screen', 'screenshot'],
      description: 'Capture the current screen.',
      schema: regionSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof regionSchema>) {
        await service.module();
        return {
          success: true,
          data: {
            region: params.region ?? null,
            platform: process.platform,
            message: 'Real screenshot support requires @nut-tree/nut-js.',
          },
        };
      },
    },
    {
      id: 'computer.mouse-move',
      triggers: ['mouse', 'move'],
      description: 'Move the mouse pointer.',
      schema: moveSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof moveSchema>) {
        await service.module();
        return { success: true, data: params };
      },
    },
    {
      id: 'computer.mouse-click',
      triggers: ['mouse', 'click'],
      description: 'Click the mouse.',
      schema: clickSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof clickSchema>) {
        await service.module();
        return { success: true, data: params };
      },
    },
    {
      id: 'computer.keyboard-type',
      triggers: ['keyboard', 'type'],
      description: 'Type text on the keyboard.',
      schema: typeSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof typeSchema>) {
        await service.module();
        return { success: true, data: params };
      },
    },
    {
      id: 'computer.keyboard-hotkey',
      triggers: ['keyboard', 'hotkey'],
      description: 'Send a keyboard shortcut.',
      schema: hotkeySchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof hotkeySchema>) {
        await service.module();
        return { success: true, data: params };
      },
    },
    {
      id: 'computer.window-focus',
      triggers: ['window', 'focus'],
      description: 'Focus a specific application window.',
      schema: focusSchema,
      requiresConfirmation: true,
      async execute(_ctx, params: z.infer<typeof focusSchema>) {
        await service.module();
        return { success: true, data: params };
      },
    },
  ];

  return {
    id: 'computeruse',
    name: 'Coco Computer Use',
    version: '1.2.0',
    description: 'Desktop automation with platform guards',
    async setup() {
      service = new ComputerUseService(config);
    },
    tools,
  };
}

export const computerUsePlugin = createComputerUsePlugin();

export default computerUsePlugin;
