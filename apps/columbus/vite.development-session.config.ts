import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const directory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(
        directory,
        'src/scripts/development-session/development-session-content.ts',
      ),
      formats: ['iife'],
      name: 'AtlasDevelopmentSessionContent',
      fileName: () => 'development-session-content.js',
    },
  },
});
