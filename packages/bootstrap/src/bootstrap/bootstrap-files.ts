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
import { createNginxConfig } from './nginx-config.js';

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

  const files: AtlasBootstrapFile[] = [
    { path: 'index.html', contents: withTrailingNewline(html) },

    ...createBrowserAssetFiles(),
  ];

  return [
    ...files,
    {
      path: 'nginx.conf',
      contents: createNginxConfig(options.assetOrigins),
    },
  ];
}

function withTrailingNewline(contents: string): string {
  return contents.endsWith('\n') ? contents : `${contents}\n`;
}
