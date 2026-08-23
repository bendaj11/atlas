import type { AtlasHostRuntimeConfig } from '@atlas/schema';

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
