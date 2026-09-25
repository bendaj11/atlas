import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const directory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    lib: {
      entry: resolve(
        directory,
        'src/scripts/preview-launcher/preview-launcher-content/preview-launcher-content.ts',
      ),
      formats: ['iife'],
      name: 'AtlasPreviewLauncherContent',
      fileName: () => 'preview-launcher-content.js',
    },
  },
});
