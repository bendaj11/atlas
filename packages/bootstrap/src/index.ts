import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DEFAULT_TITLE = 'Atlas';
const DEFAULT_LOADING_HTML = 'Loading product…';
const require = createRequire(import.meta.url);
const MODULE_SHIM_SOURCE = readFileSync(
  require.resolve('es-module-shims'),
  'utf8',
);
export const ATLAS_BROWSER_LOADER = readFileSync(
  new URL('./atlas.loader.js', import.meta.url),
  'utf8',
);
const VERSIONED_LOADER_SOURCE = `/atlas.loader.js?v=${createHash('sha256')
  .update(ATLAS_BROWSER_LOADER)
  .digest('hex')
  .slice(0, 12)}`;

export interface AtlasBootstrapOptions {
  runtime?: AtlasHostRuntimeConfig;
  runtimeConfig?: 'embedded' | 'external';
  html?: string;
  title?: string;
  loadingHtml?: string;
  assetOrigins?: readonly string[];
}

export interface AtlasBootstrapFile {
  path:
    | 'index.html'
    | 'atlas.loader.js'
    | 'es-module-shims.js'
    | 'atlas.runtime.json'
    | 'nginx.conf';
  contents: string;
}

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
    { path: 'index.html', contents: html.endsWith('\n') ? html : `${html}\n` },
    {
      path: 'atlas.loader.js',
      contents: `${ATLAS_BROWSER_LOADER.trimEnd()}\n`,
    },
    { path: 'es-module-shims.js', contents: MODULE_SHIM_SOURCE },
  ];
  if (options.runtimeConfig === 'external') return files;

  const runtime = requiredRuntime(options.runtime);
  return [
    ...files,
    {
      path: 'atlas.runtime.json',
      contents: `${JSON.stringify(runtime, null, 2)}\n`,
    },
    {
      path: 'nginx.conf',
      contents: createNginxConfig(options.assetOrigins ?? runtimeAssetOrigins(runtime)),
    },
  ];
}

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

function versionLoaderSource(html: string): string {
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

export function createNginxConfig(
  assetOrigins: readonly string[] = [],
): string {
  const contentOrigins = normalizedOrigins(assetOrigins);
  const localHttpOrigins = ['http://localhost:*', 'http://127.0.0.1:*', 'http://[::1]:*'];
  const localWebSocketOrigins = ['ws://localhost:*', 'ws://127.0.0.1:*', 'ws://[::1]:*'];
  const contentSources = cspSources([...contentOrigins, ...localHttpOrigins]);
  const connectSources = cspSources([
    ...contentOrigins,
    ...localHttpOrigins,
    ...localWebSocketOrigins,
  ]);
  return `server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;

  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' blob:${contentSources}; connect-src 'self' blob:${connectSources}; style-src 'self' 'unsafe-inline' blob:${contentSources}; img-src 'self' data:${contentSources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

  location = /health/live {
    default_type text/plain;
    return 200 "ok\\n";
  }

  location = /atlas.runtime.json {
    expires -1;
    try_files $uri =404;
  }

  location = /index.html {
    expires -1;
  }

  location = /atlas.loader.js {
    expires -1;
    try_files $uri =404;
  }

  location ~ \\.[^/]+$ {
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;
}

function runtimeAssetOrigins(runtime: AtlasHostRuntimeConfig): string[] {
  return [
    new URL(runtime.catalogUrl).origin,
    ...(runtime.assetOrigins ?? []),
    ...(runtime.externalRegistryUrls ?? []).map((url) => new URL(url).origin),
  ];
}

function normalizedOrigins(origins: readonly string[]): string[] {
  return [
    ...new Set(origins.filter(Boolean).map((origin) => new URL(origin).origin)),
  ];
}

function cspSources(origins: readonly string[]): string {
  return origins.length > 0 ? ` ${origins.join(' ')}` : '';
}

function validateRuntime(runtime: AtlasHostRuntimeConfig): void {
  if (!runtime.hostId.trim())
    throw new Error('Atlas bootstrap requires a non-empty hostId.');
  try {
    new URL(runtime.catalogUrl);
  } catch {
    throw new Error('Atlas bootstrap requires an absolute catalogUrl.');
  }
}

function requiredRuntime(
  runtime: AtlasHostRuntimeConfig | undefined,
): AtlasHostRuntimeConfig {
  if (!runtime)
    throw new Error(
      'Atlas bootstrap requires runtime configuration unless --runtime-config=external is used.',
    );
  validateRuntime(runtime);
  return runtime;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
