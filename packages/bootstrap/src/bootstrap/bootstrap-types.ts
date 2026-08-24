export interface AtlasBootstrapOptions {
  html?: string;
  title?: string;
  loadingHtml?: string;
  assetOrigins?: readonly string[];
}

export interface AtlasBootstrapFile {
  path: 'index.html' | 'atlas.loader.js' | 'es-module-shims.js' | 'nginx.conf';
  contents: string;
}
