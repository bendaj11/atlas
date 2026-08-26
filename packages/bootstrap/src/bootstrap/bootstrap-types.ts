export interface AtlasBootstrapOptions {
  html?: string;
  title?: string;
  loadingHtml?: string;
}

export interface AtlasBootstrapFile {
  path: 'index.html' | 'atlas.loader.js';
  contents: string;
}
