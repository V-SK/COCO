import {
  CocoError,
  type CocoPlugin,
  type CocoTool,
  type ToolResult,
  assertAllowedUrl,
  optionalImport,
} from '@coco/core';
import { z } from 'zod';

export interface BrowserConfig {
  headless?: boolean | undefined;
  viewport?: { width: number; height: number } | undefined;
  timeout?: number | undefined;
  userAgent?: string | undefined;
  allowedHosts?: string[] | undefined;
  blockedHosts?: string[] | undefined;
}

type PageHandle = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<void>;
  screenshot: (options?: Record<string, unknown>) => Promise<Uint8Array>;
  click: (selector: string, options?: Record<string, unknown>) => Promise<void>;
  fill: (selector: string, text: string) => Promise<void>;
  evaluate: (script: string) => Promise<unknown>;
  locator: (selector: string) => {
    textContent: () => Promise<string | null>;
    evaluateAll?: (fn: unknown, attribute?: string) => Promise<unknown>;
  };
  mouse: {
    wheel: (x: number, y: number) => Promise<void>;
  };
};

class BrowserService {
  readonly #config: BrowserConfig;
  #page: PageHandle | undefined;
  #browser:
    | {
        newPage: (options?: Record<string, unknown>) => Promise<PageHandle>;
        close: () => Promise<void>;
      }
    | undefined;

  constructor(config: BrowserConfig = {}) {
    this.#config = config;
  }

  async page(): Promise<PageHandle> {
    if (this.#page) {
      return this.#page;
    }

    const playwright = await optionalImport<{
      chromium: {
        launch: (options?: Record<string, unknown>) => Promise<{
          newPage: (options?: Record<string, unknown>) => Promise<PageHandle>;
          close: () => Promise<void>;
        }>;
      };
    }>('playwright');

    if (!playwright) {
      throw new CocoError(
        'playwright is not installed. Add it to enable browser automation.',
        'browser_dependency_missing',
      );
    }

    this.#browser = await playwright.chromium.launch({
      headless: this.#config.headless ?? true,
    });
    this.#page = await this.#browser.newPage({
      viewport: this.#config.viewport,
      userAgent: this.#config.userAgent,
    });
    return this.#page;
  }

  async close(): Promise<void> {
    await this.#browser?.close();
    this.#browser = undefined;
    this.#page = undefined;
  }

  assertUrl(url: string): string {
    return assertAllowedUrl(url, {
      allowedHosts: this.#config.allowedHosts,
      blockedHosts: this.#config.blockedHosts,
    }).toString();
  }
}

let browserService = new BrowserService();

export function createBrowserPlugin(config: BrowserConfig = {}): CocoPlugin {
  const navigateSchema = z.object({
    url: z.string().url(),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  });
  const screenshotSchema = z.object({
    selector: z.string().optional(),
    fullPage: z.boolean().optional(),
  });
  const clickSchema = z.object({
    selector: z.string(),
    button: z.enum(['left', 'right', 'middle']).optional(),
  });
  const typeSchema = z.object({
    selector: z.string(),
    text: z.string(),
    delay: z.number().optional(),
  });
  const scrollSchema = z.object({
    direction: z.enum(['up', 'down', 'left', 'right']),
    amount: z.number().optional(),
  });
  const extractSchema = z.object({
    selector: z.string(),
    attribute: z.string().optional(),
    multiple: z.boolean().optional(),
  });
  const executeSchema = z.object({
    script: z.string(),
  });

  const wrap = <T>(
    id: string,
    description: string,
    schema: z.ZodType<T>,
    execute: (params: T) => Promise<ToolResult>,
    requiresConfirmation = false,
  ): CocoTool<T> => ({
    id,
    triggers: [id],
    description,
    schema,
    requiresConfirmation,
    async execute(_ctx, params) {
      return execute(params);
    },
  });

  return {
    id: 'browser',
    name: 'Coco Browser',
    version: '1.2.0',
    description: 'Playwright-powered browser automation',
    async setup() {
      browserService = new BrowserService(config);
    },
    async teardown() {
      await browserService.close();
    },
    tools: [
      wrap<z.infer<typeof navigateSchema>>(
        'browser.navigate',
        'Navigate to a URL.',
        navigateSchema,
        async (params) => {
          const page = await browserService.page();
          const url = browserService.assertUrl(params.url);
          await page.goto(url, {
            waitUntil: params.waitUntil,
            timeout: config.timeout ?? 30_000,
          });
          return { success: true, data: { url } };
        },
      ),
      wrap<z.infer<typeof screenshotSchema>>(
        'browser.screenshot',
        'Capture a browser screenshot.',
        screenshotSchema,
        async (params) => {
          const page = await browserService.page();
          const image = await page.screenshot({
            fullPage: params.fullPage ?? true,
          });
          return {
            success: true,
            data: {
              imageBase64: Buffer.from(image).toString('base64'),
              selector: params.selector,
            },
          };
        },
      ),
      wrap<z.infer<typeof clickSchema>>(
        'browser.click',
        'Click an element in the browser.',
        clickSchema,
        async (params) => {
          const page = await browserService.page();
          await page.click(params.selector, {
            button: params.button ?? 'left',
            timeout: config.timeout ?? 30_000,
          });
          return { success: true, data: { clicked: params.selector } };
        },
      ),
      wrap<z.infer<typeof typeSchema>>(
        'browser.type',
        'Type text into a browser element.',
        typeSchema,
        async (params) => {
          const page = await browserService.page();
          await page.fill(params.selector, params.text);
          return { success: true, data: { selector: params.selector } };
        },
      ),
      wrap<z.infer<typeof scrollSchema>>(
        'browser.scroll',
        'Scroll the current page.',
        scrollSchema,
        async (params) => {
          const page = await browserService.page();
          const amount = params.amount ?? 400;
          const delta = params.direction === 'up' ? -amount : amount;
          await page.mouse.wheel(0, delta);
          return { success: true, data: { amount: delta } };
        },
      ),
      wrap<z.infer<typeof extractSchema>>(
        'browser.extract',
        'Extract text or attributes from a browser element.',
        extractSchema,
        async (params) => {
          const page = await browserService.page();
          const locator = page.locator(params.selector);
          const text = await locator.textContent();
          return {
            success: true,
            data: {
              selector: params.selector,
              value: text,
              attribute: params.attribute ?? 'textContent',
            },
          };
        },
      ),
      wrap<z.infer<typeof executeSchema>>(
        'browser.execute-js',
        'Execute JavaScript in the current page.',
        executeSchema,
        async (params) => {
          const page = await browserService.page();
          return {
            success: true,
            data: { result: await page.evaluate(params.script) },
          };
        },
        true,
      ),
    ],
  };
}

export const browserPlugin = createBrowserPlugin();

export default browserPlugin;
