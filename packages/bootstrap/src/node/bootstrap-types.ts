export interface AtlasBootstrapOptions {
  html?: string;
  title?: string;
  loadingHtml?: string;
}

export type AtlasBootstrapFilePath =
  'index.html' | 'atlas.loader.js' | 'es-module-shims.js';

export interface AtlasBootstrapFile {
  path: AtlasBootstrapFilePath;
  contents: string;
}
