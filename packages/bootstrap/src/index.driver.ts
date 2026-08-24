import {
  createAtlasBootstrapFiles,
  createBootstrapHtml,
  createNginxConfig,
  validateBootstrapHtml,
} from '../dist/index.js';

const DEFAULT_ASSET_ORIGINS = ['https://assets.example'];

export class IndexDriver {
  private html: string | undefined;
  private files = new Map<string, string>();

  readonly given = {
    html: (html: string): IndexDriver => {
      this.html = html;
      return this;
    },
  };

  readonly when = {
    createFiles: (): IndexDriver => {
      this.files = new Map(
        createAtlasBootstrapFiles({
          assetOrigins: DEFAULT_ASSET_ORIGINS,
          ...(this.html === undefined ? {} : { html: this.html }),
        }).map((file) => [file.path, file.contents]),
      );
      return this;
    },
  };

  readonly get = {
    fileContents: (path: string): string => this.files.get(path) ?? '',
    filePaths: (): string[] => [...this.files.keys()],
    html: (
      options: { readonly loadingHtml?: string; readonly title?: string } = {},
    ): string => createBootstrapHtml(options),
    htmlValidationError: (html: string): string => {
      try {
        validateBootstrapHtml(html);
        return '';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    nginxConfig: (
      assetOrigins: readonly string[] = DEFAULT_ASSET_ORIGINS,
    ): string => createNginxConfig(assetOrigins),
  };
}
