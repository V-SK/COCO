import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@coco/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@coco/plugin-price': resolve(
        __dirname,
        'packages/plugin-price/src/index.ts',
      ),
      '@coco/plugin-scan': resolve(
        __dirname,
        'packages/plugin-scan/src/index.ts',
      ),
      '@coco/plugin-swap': resolve(
        __dirname,
        'packages/plugin-swap/src/index.ts',
      ),
      '@coco/plugin-wallet': resolve(
        __dirname,
        'packages/plugin-wallet/src/index.ts',
      ),
      '@coco/connector-web': resolve(
        __dirname,
        'packages/connector-web/src/index.ts',
      ),
      '@coco/plugin-nfa': resolve(
        __dirname,
        'packages/plugin-nfa/src/index.ts',
      ),
      '@coco/connector-telegram': resolve(
        __dirname,
        'packages/connector-telegram/src/index.ts',
      ),
      '@coco/connector-discord': resolve(
        __dirname,
        'packages/connector-discord/src/index.ts',
      ),
      '@coco/plugin-ollama': resolve(
        __dirname,
        'packages/plugin-ollama/src/index.ts',
      ),
      '@coco/plugin-browser': resolve(
        __dirname,
        'packages/plugin-browser/src/index.ts',
      ),
      '@coco/plugin-shell': resolve(
        __dirname,
        'packages/plugin-shell/src/index.ts',
      ),
      '@coco/plugin-cron': resolve(
        __dirname,
        'packages/plugin-cron/src/index.ts',
      ),
      '@coco/plugin-memory': resolve(
        __dirname,
        'packages/plugin-memory/src/index.ts',
      ),
      '@coco/plugin-computeruse': resolve(
        __dirname,
        'packages/plugin-computeruse/src/index.ts',
      ),
      '@coco/plugin-vision': resolve(
        __dirname,
        'packages/plugin-vision/src/index.ts',
      ),
      '@coco/plugin-knowledge': resolve(
        __dirname,
        'packages/plugin-knowledge/src/index.ts',
      ),
      '@coco/plugin-tts': resolve(
        __dirname,
        'packages/plugin-tts/src/index.ts',
      ),
      '@coco/plugin-sql': resolve(
        __dirname,
        'packages/plugin-sql/src/index.ts',
      ),
      '@coco/plugin-orchestrator': resolve(
        __dirname,
        'packages/plugin-orchestrator/src/index.ts',
      ),
      '@coco/connector-twitter': resolve(
        __dirname,
        'packages/connector-twitter/src/index.ts',
      ),
      '@coco/plugin-chain-events': resolve(
        __dirname,
        'packages/plugin-chain-events/src/index.ts',
      ),
      '@coco/plugin-alerts': resolve(
        __dirname,
        'packages/plugin-alerts/src/index.ts',
      ),
      '@coco/plugin-dex-agg': resolve(
        __dirname,
        'packages/plugin-dex-agg/src/index.ts',
      ),
      '@coco/plugin-webhook': resolve(
        __dirname,
        'packages/plugin-webhook/src/index.ts',
      ),
      '@coco/plugin-history': resolve(
        __dirname,
        'packages/plugin-history/src/index.ts',
      ),
      '@coco/plugin-nft': resolve(
        __dirname,
        'packages/plugin-nft/src/index.ts',
      ),
      '@coco/plugin-news': resolve(
        __dirname,
        'packages/plugin-news/src/index.ts',
      ),
      '@coco/plugin-polymarket': resolve(
        __dirname,
        'packages/plugin-polymarket/src/index.ts',
      ),
      '@coco/plugin-quant-signal': resolve(
        __dirname,
        'packages/plugin-quant-signal/src/index.ts',
      ),
      '@coco/plugin-report': resolve(
        __dirname,
        'packages/plugin-report/src/index.ts',
      ),
      '@coco/plugin-trust-score': resolve(
        __dirname,
        'packages/plugin-trust-score/src/index.ts',
      ),
      '@coco/plugin-auto-trade': resolve(
        __dirname,
        'packages/plugin-auto-trade/src/index.ts',
      ),
      '@coco/plugin-copy-trade': resolve(
        __dirname,
        'packages/plugin-copy-trade/src/index.ts',
      ),
      '@coco/plugin-whale-alert': resolve(
        __dirname,
        'packages/plugin-whale-alert/src/index.ts',
      ),
    },
  },
  test: {
    coverage: {
      exclude: [
        'apps/**',
        'coverage/**',
        '**/dist/**',
        'scripts/**',
        'vitest.config.ts',
        'packages/core/src/types.ts',
        'packages/core/src/llm/interface.ts',
        'packages/core/src/llm/ollama.ts',
        'packages/core/src/memory/index.ts',
        'packages/plugin-price/src/binance.ts',
        'packages/plugin-swap/src/pancakeswap.ts',
        'packages/connector-web/src/index.ts',
        'packages/connector-discord/**',
        'packages/connector-telegram/**',
        'packages/connector-twitter/**',
        'packages/plugin-alerts/**',
        'packages/plugin-browser/**',
        'packages/plugin-chain-events/**',
        'packages/plugin-computeruse/**',
        'packages/plugin-cron/**',
        'packages/plugin-dex-agg/**',
        'packages/plugin-history/**',
        'packages/plugin-knowledge/**',
        'packages/plugin-memory/**',
        'packages/plugin-nfa/**',
        'packages/plugin-nft/**',
        'packages/plugin-news/**',
        'packages/plugin-ollama/**',
        'packages/plugin-orchestrator/**',
        'packages/plugin-polymarket/**',
        'packages/plugin-shell/**',
        'packages/plugin-sql/**',
        'packages/plugin-tts/**',
        'packages/plugin-quant-signal/**',
        'packages/plugin-report/**',
        'packages/plugin-trust-score/**',
        'packages/plugin-auto-trade/**',
        'packages/plugin-copy-trade/**',
        'packages/plugin-whale-alert/**',
        'packages/plugin-vision/**',
        'packages/plugin-webhook/**',
      ],
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 80,
        lines: 80,
      },
    },
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
});
