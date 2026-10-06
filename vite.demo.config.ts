import { defineConfig } from 'vite';
import { bare } from './scripts/comments.ts';
import { iconBoundary } from './scripts/icon-boundary.ts';

export default defineConfig({
  publicDir: false,
  plugins: [iconBoundary(), bare()],
  build: {
    outDir: 'dist/demo',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: 'demo/client.ts',
      output: { entryFileNames: 'client.js', inlineDynamicImports: true },
    },
  },
});
