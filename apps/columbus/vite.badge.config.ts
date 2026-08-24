import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const directory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(directory, 'src/scripts/badge/badge-script.ts'),
      formats: ['iife'],
      name: 'AtlasColumbusContentScript',
      fileName: () => 'badge-script.js',
    },
  },
});
