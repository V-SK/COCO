import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type CocoPlugin,
  type CocoTool,
  SqliteStructuredStore,
  optionalImport,
} from '@coco/core';
import { z } from 'zod';

export interface ReportConfig {
  type: 'token-analysis' | 'market-overview' | 'portfolio-review';
  format: 'pdf' | 'md' | 'html';
  token?: string | undefined;
  tokens?: string[] | undefined;
  walletAddress?: string | undefined;
  period?: '7d' | '30d' | '90d' | undefined;
  language?: 'zh' | 'en' | undefined;
  includeCharts?: boolean | undefined;
}

export interface GeneratedReport {
  id: string;
  type: ReportConfig['type'];
  format: ReportConfig['format'];
  title: string;
  generatedAt: number;
  filePath: string;
  fileSize: number;
  summary: string;
  sections: string[];
}

export interface ReportPluginConfig {
  outputDir?: string | undefined;
  storagePath?: string | undefined;
}

class ReportService {
  readonly #outputDir: string;
  readonly #store: SqliteStructuredStore;

  constructor(config: ReportPluginConfig) {
    this.#outputDir = resolve(config.outputDir ?? 'reports');
    this.#store = new SqliteStructuredStore(
      config.storagePath ?? 'coco-report.sqlite',
    );
  }

  close() {
    this.#store.close();
  }

  list() {
    return this.#store.list<GeneratedReport>('reports');
  }

  async generate(
    ctx: Parameters<CocoTool['execute']>[0],
    config: ReportConfig,
  ): Promise<GeneratedReport | { error: string; code: string }> {
    await mkdir(this.#outputDir, { recursive: true });
    const payload = await this.collectPayload(ctx, config);
    const title = this.buildTitle(config);
    const markdown = this.renderMarkdown(config, title, payload);
    const html = this.renderHtml(
      title,
      markdown,
      config.includeCharts ?? false,
    );
    const id = `${config.type}-${Date.now()}`;
    const basePath = resolve(this.#outputDir, id);

    const filePath = `${basePath}.${config.format}`;
    if (config.format === 'md') {
      await writeFile(filePath, markdown, 'utf8');
    } else if (config.format === 'html') {
      await writeFile(filePath, html, 'utf8');
    } else {
      const browserModule =
        (await optionalImport<{
          default?: {
            launch?: (options?: Record<string, unknown>) => Promise<{
              newPage: () => Promise<{
                setContent: (
                  value: string,
                  options?: Record<string, unknown>,
                ) => Promise<void>;
                pdf: (options: Record<string, unknown>) => Promise<Buffer>;
                close: () => Promise<void>;
              }>;
              close: () => Promise<void>;
            }>;
          };
          launch?: (options?: Record<string, unknown>) => Promise<{
            newPage: () => Promise<{
              setContent: (
                value: string,
                options?: Record<string, unknown>,
              ) => Promise<void>;
              pdf: (options: Record<string, unknown>) => Promise<Buffer>;
              close: () => Promise<void>;
            }>;
            close: () => Promise<void>;
          }>;
        }>('puppeteer')) ??
        (await optionalImport<{
          default?: {
            launch?: (options?: Record<string, unknown>) => Promise<{
              newPage: () => Promise<{
                setContent: (
                  value: string,
                  options?: Record<string, unknown>,
                ) => Promise<void>;
                pdf: (options: Record<string, unknown>) => Promise<Buffer>;
                close: () => Promise<void>;
              }>;
              close: () => Promise<void>;
            }>;
          };
          launch?: (options?: Record<string, unknown>) => Promise<{
            newPage: () => Promise<{
              setContent: (
                value: string,
                options?: Record<string, unknown>,
              ) => Promise<void>;
              pdf: (options: Record<string, unknown>) => Promise<Buffer>;
              close: () => Promise<void>;
            }>;
            close: () => Promise<void>;
          }>;
        }>('puppeteer-core'));
      const launch = browserModule?.launch ?? browserModule?.default?.launch;
      if (!launch) {
        return {
          error: 'Puppeteer is not installed; PDF generation is unavailable.',
          code: 'report_pdf_unavailable',
        };
      }
      const browser = await launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: 'new',
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await writeFile(filePath, pdf);
      await page.close();
      await browser.close();
    }
    const fileSize = (await stat(filePath)).size;
    const report: GeneratedReport = {
      id,
      type: config.type,
      format: config.format,
      title,
      generatedAt: Date.now(),
      filePath,
      fileSize,
      summary: payload.summary,
      sections: payload.sections,
    };
    this.#store.save('reports', id, report);
    return report;
  }

  buildTitle(config: ReportConfig) {
    if (config.type === 'token-analysis') {
      return `${config.token ?? 'Token'} Deep Analysis Report`;
    }
    if (config.type === 'market-overview') {
      return 'Market Overview Report';
    }
    return `Portfolio Review ${config.walletAddress ?? ''}`.trim();
  }

  async collectPayload(
    ctx: Parameters<CocoTool['execute']>[0],
    config: ReportConfig,
  ) {
    if (config.type === 'token-analysis' && config.token) {
      const [trust, signal, news] = await Promise.all([
        ctx.runtime.invokeTool('trust-score.get-trust-score', ctx, {
          token: config.token,
          detailed: true,
        }),
        ctx.runtime.invokeTool('quant-signal.get-signal', ctx, {
          token: config.token,
        }),
        ctx.runtime.invokeTool('news.get-news', ctx, {
          token: config.token,
          limit: 5,
        }),
      ]);
      return {
        sections: [
          'Overview',
          'Trust Score',
          'Signal Analysis',
          'News & Sentiment',
          'Risk Notes',
        ],
        summary: `Token analysis for ${config.token} generated with trust, signal, and news inputs.`,
        blocks: {
          trust: trust.data ?? trust.error,
          signal: signal.data ?? signal.error,
          news: news.data ?? news.error,
        },
      };
    }

    if (config.type === 'market-overview') {
      const tokens = config.tokens ?? ['BNB', 'BTC', 'ETH'];
      const signals = await Promise.all(
        tokens.map(
          async (token) =>
            await ctx.runtime.invokeTool('quant-signal.get-signal', ctx, {
              token,
            }),
        ),
      );
      return {
        sections: ['Overview', 'Signals', 'News', 'Takeaways'],
        summary: `Market overview across ${tokens.join(', ')}.`,
        blocks: {
          signals: signals.map((entry) => entry.data ?? entry.error),
        },
      };
    }

    const [history, positions] = await Promise.all([
      config.walletAddress
        ? ctx.runtime.invokeTool('history.get-tx-history', ctx, {
            address: config.walletAddress,
            limit: 10,
          })
        : Promise.resolve({ data: [] }),
      ctx.runtime.invokeTool('auto-trade.get-positions', ctx, {}),
    ]);
    return {
      sections: ['Portfolio Summary', 'Positions', 'Recent Activity'],
      summary: `Portfolio review for ${config.walletAddress ?? 'unknown wallet'}.`,
      blocks: {
        positions: positions.data ?? [],
        history: history.data ?? [],
      },
    };
  }

  renderMarkdown(
    config: ReportConfig,
    title: string,
    payload: {
      summary: string;
      sections: string[];
      blocks: Record<string, unknown>;
    },
  ) {
    return [
      `# ${title}`,
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Summary',
      payload.summary,
      '',
      ...payload.sections.flatMap((section) => [
        `## ${section}`,
        '```json',
        JSON.stringify(payload.blocks, null, 2),
        '```',
        '',
      ]),
      `Language: ${config.language ?? 'en'}`,
    ].join('\n');
  }

  renderHtml(title: string, markdown: string, includeCharts: boolean) {
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: Georgia, serif; padding: 40px; color: #1d2433; }
      pre { white-space: pre-wrap; background: #f4f4f0; padding: 16px; border-radius: 8px; }
      .hero { padding: 24px; background: linear-gradient(135deg, #f8f6ef, #dce8f7); border-radius: 16px; margin-bottom: 24px; }
      .chart { margin-top: 20px; height: 140px; background: linear-gradient(90deg, #d8efe5, #f3d7b8); border-radius: 12px; display: ${includeCharts ? 'block' : 'none'}; }
    </style>
  </head>
  <body>
    <div class="hero">
      <h1>${title}</h1>
      <p>Coco Framework report export</p>
    </div>
    <pre>${escaped}</pre>
    <div class="chart"></div>
  </body>
</html>`;
  }
}

let reportService = new ReportService({});

export function createReportPlugin(
  config: ReportPluginConfig = {},
): CocoPlugin {
  const generateSchema = z.object({
    type: z.enum(['token-analysis', 'market-overview', 'portfolio-review']),
    format: z.enum(['pdf', 'md', 'html']),
    token: z.string().optional(),
    tokens: z.array(z.string()).optional(),
    walletAddress: z.string().optional(),
    period: z.enum(['7d', '30d', '90d']).optional(),
    language: z.enum(['zh', 'en']).optional(),
    includeCharts: z.boolean().optional(),
  });

  const tools: CocoTool[] = [
    {
      id: 'report.generate-report',
      triggers: ['report', 'generate'],
      description:
        'Generate a token, market, or portfolio report in md/html/pdf.',
      schema: generateSchema,
      async execute(ctx, params: z.infer<typeof generateSchema>) {
        const report = await reportService.generate(ctx, params);
        if ('error' in report) {
          return {
            success: false,
            error: report.error,
            code: report.code,
          };
        }
        return { success: true, data: report };
      },
    },
    {
      id: 'report.list-templates',
      triggers: ['report', 'templates'],
      description: 'List built-in report templates.',
      async execute() {
        return {
          success: true,
          data: ['token-analysis', 'market-overview', 'portfolio-review'],
        };
      },
    },
  ];

  return {
    id: 'report',
    name: 'Coco Report',
    version: '1.2.0',
    description: 'Markdown, HTML, and PDF report generation',
    async setup() {
      reportService = new ReportService(config);
    },
    async teardown() {
      reportService.close();
    },
    tools,
  };
}

export const reportPlugin = createReportPlugin();

export default reportPlugin;
