import { createBrowserAssetFiles } from '../bootstrap-assets.js';
import {
  createBootstrapHtml,
  validateBootstrapHtml,
  applyVersionedLoaderSource,
} from '../bootstrap-html/bootstrap-html.js';
import type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from '../bootstrap-types.js';

export function createAtlasBootstrapFiles(
  options: AtlasBootstrapOptions,
): AtlasBootstrapFile[] {
  const html = applyVersionedLoaderSource(
    options.html ??
      createBootstrapHtml({
        ...(options.title !== undefined ? { title: options.title } : {}),
        ...(options.loadingHtml !== undefined
          ? { loadingHtml: options.loadingHtml }
          : {}),
      }),
  );

  validateBootstrapHtml(html);

  return [
    { path: 'index.html', contents: ensureTrailingNewline(html) },
    ...createBrowserAssetFiles(),
  ];
}

function ensureTrailingNewline(contents: string): string {
  return contents.endsWith('\n') ? contents : `${contents}\n`;
}
