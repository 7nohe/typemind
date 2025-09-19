import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// tailwind v4 plugin is ESM-only; load dynamically in config factory
import path from 'node:path';

export default defineConfig(async () => {
  const { default: tailwind } = await import('@tailwindcss/vite');
  return {
    plugins: [react(), tailwind()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      global: 'globalThis',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, 'src/popup/index.html'),
          background: path.resolve(__dirname, 'src/background/service-worker.ts'),
        },
        output: {
          entryFileNames: (chunk) => {
            if (chunk.name === 'background') return 'background.js';
            if (chunk.name === 'popup') return 'popup/[name].js';
            return '[name].js';
          },
          chunkFileNames: (chunk) => {
            if (chunk.name?.startsWith('popup')) return 'popup/[name].js';
            return 'chunks/[name].js';
          },
          assetFileNames: (asset) => {
            if (asset.name?.includes('index.html')) return 'popup/index.html';
            if (asset.name?.includes('src/popup')) return 'popup/[name][extname]';
            return 'assets/[name][extname]';
          },
        },
      },
    },
  };
});
