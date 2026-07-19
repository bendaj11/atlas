import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import { ATLAS_BROWSER_LOADER } from "./browser-loader.js";

export { ATLAS_BROWSER_LOADER } from "./browser-loader.js";

const DEFAULT_TITLE = "Atlas";
const DEFAULT_LOADING_HTML = "Loading product…";

export interface AtlasBootstrapOptions {
  runtime: AtlasHostRuntimeConfig;
  html?: string;
  title?: string;
  loadingHtml?: string;
  assetOrigins?: readonly string[];
}

export interface AtlasBootstrapFile {
  path: "index.html" | "atlas.loader.js" | "atlas.runtime.json" | "nginx.conf";
  contents: string;
}

export function createAtlasBootstrapFiles(options: AtlasBootstrapOptions): AtlasBootstrapFile[] {
  validateRuntime(options.runtime);
  const html = options.html ?? createBootstrapHtml({
    ...(options.title !== undefined ? { title: options.title } : {}),
    ...(options.loadingHtml !== undefined ? { loadingHtml: options.loadingHtml } : {})
  });
  validateBootstrapHtml(html);
  return [
    { path: "index.html", contents: html.endsWith("\n") ? html : `${html}\n` },
    { path: "atlas.loader.js", contents: `${ATLAS_BROWSER_LOADER.trimEnd()}\n` },
    { path: "atlas.runtime.json", contents: `${JSON.stringify(options.runtime, null, 2)}\n` },
    {
      path: "nginx.conf",
      contents: createNginxConfig(
        options.assetOrigins ?? runtimeAssetOrigins(options.runtime),
        options.runtime.allowCustomOverrides ?? options.runtime.allowOverrides
      )
    }
  ];
}

export function createBootstrapHtml(options: Pick<AtlasBootstrapOptions, "title" | "loadingHtml"> = {}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title ?? DEFAULT_TITLE)}</title>
  </head>
  <body>
    <div id="atlas-host-root">${options.loadingHtml ?? DEFAULT_LOADING_HTML}</div>
    <script type="module" src="/atlas.loader.js"></script>
  </body>
</html>`;
}

export function validateBootstrapHtml(html: string): void {
  if (!/\bid=["']atlas-host-root["']/.test(html)) {
    throw new Error('Atlas bootstrap template must contain an element with id="atlas-host-root".');
  }
  if (!/<script\b[^>]*\bsrc=["']\/atlas\.loader\.js["'][^>]*>/i.test(html)) {
    throw new Error('Atlas bootstrap template must load /atlas.loader.js with a script element.');
  }
}

export function createNginxConfig(assetOrigins: readonly string[] = [], allowOverrides = false): string {
  const contentOrigins = normalizedOrigins(assetOrigins);
  const developmentOrigins = allowOverrides ? ["http://localhost:*", "http://127.0.0.1:*"] : [];
  const origins = [...contentOrigins, ...developmentOrigins].join(" ");
  const sources = origins ? ` ${origins}` : "";
  return `server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;

  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' blob:${sources}; connect-src 'self' blob:${sources}; style-src 'self' 'unsafe-inline' blob:${sources}; img-src 'self' data:${sources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

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
    ...(runtime.externalRegistryUrls ?? []).map((url) => new URL(url).origin)
  ];
}

function normalizedOrigins(origins: readonly string[]): string[] {
  return [...new Set(origins.filter(Boolean).map((origin) => new URL(origin).origin))];
}

function validateRuntime(runtime: AtlasHostRuntimeConfig): void {
  if (!runtime.hostId.trim()) throw new Error("Atlas bootstrap requires a non-empty hostId.");
  try {
    new URL(runtime.catalogUrl);
  } catch {
    throw new Error("Atlas bootstrap requires an absolute catalogUrl.");
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
