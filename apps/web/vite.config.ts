import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom')
          ) {
            return 'vendor-react';
          }

          if (
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/@tanstack/react-query')
          ) {
            return 'vendor-data';
          }

          if (
            id.includes('node_modules/wagmi') ||
            id.includes('node_modules/@wagmi')
          ) {
            return 'vendor-wagmi';
          }

          if (
            id.includes('node_modules/viem') ||
            id.includes('node_modules/abitype')
          ) {
            return 'vendor-viem';
          }

          if (id.includes('node_modules/@reown/appkit-adapter-wagmi')) {
            return 'vendor-wallet-adapter';
          }

          if (id.includes('node_modules/@walletconnect')) {
            return 'vendor-walletconnect';
          }

          if (id.includes('node_modules/@reown/appkit')) {
            return 'vendor-wallet';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
