import { VERSIONED_LOADER_SOURCE } from './bootstrap-assets.js';
import type { AtlasBootstrapOptions } from './bootstrap-types.js';

const DEFAULT_TITLE = 'Atlas';
const DEFAULT_LOADING_HTML = 'Loading product…';

export function createBootstrapHtml(
  options: Pick<AtlasBootstrapOptions, 'title' | 'loadingHtml'> = {},
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title ?? DEFAULT_TITLE)}</title>
  </head>
  <body>
    <div id="atlas-host-root">${options.loadingHtml ?? DEFAULT_LOADING_HTML}</div>
    <script type="module" src="${VERSIONED_LOADER_SOURCE}"></script>
  </body>
</html>`;
}

export function versionLoaderSource(html: string): string {
  return html.replace(
    /(\bsrc\s*=\s*)(["'])\/atlas\.loader\.js(?:\?[^"']*)?\2/i,
    `$1$2${VERSIONED_LOADER_SOURCE}$2`,
  );
}

export function validateBootstrapHtml(html: string): void {
  if (!/\bid=["']atlas-host-root["']/.test(html)) {
    throw new Error(
      'Atlas bootstrap template must contain an element with id="atlas-host-root".',
    );
  }

  if (
    !/<script\b[^>]*\bsrc=["']\/atlas\.loader\.js(?:\?[^"']*)?["'][^>]*>/i.test(
      html,
    )
  ) {
    throw new Error(
      'Atlas bootstrap template must load /atlas.loader.js with a script element.',
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
