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
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: path.resolve(__dirname, 'src/content/index.tsx'),
        name: 'ContentScript',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: (asset) => {
            // ensure CSS emitted under assets/
            return asset.name?.endsWith('.css')
              ? 'assets/[name][extname]'
              : 'assets/[name][extname]';
          },
        },
      },
    },
  };
});
