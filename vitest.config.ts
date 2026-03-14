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
        'packages/plugin-price/src/binance.ts',
        'packages/plugin-swap/src/pancakeswap.ts',
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
