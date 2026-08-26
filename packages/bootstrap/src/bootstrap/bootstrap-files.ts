import { createBrowserAssetFiles } from './bootstrap-assets.js';
import {
  createBootstrapHtml,
  validateBootstrapHtml,
  versionLoaderSource,
} from './bootstrap-html.js';
import type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './bootstrap-types.js';

export function createAtlasBootstrapFiles(
  options: AtlasBootstrapOptions,
): AtlasBootstrapFile[] {
  const html = versionLoaderSource(
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
    { path: 'index.html', contents: withTrailingNewline(html) },

    ...createBrowserAssetFiles()
      .filter((file): file is { path: 'atlas.loader.js'; contents: string } => file.path === 'atlas.loader.js'),
  ];

}

function withTrailingNewline(contents: string): string {
  return contents.endsWith('\n') ? contents : `${contents}\n`;
}
