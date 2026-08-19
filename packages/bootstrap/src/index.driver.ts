import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import {
  createAtlasBootstrapFiles,
  createBootstrapHtml,
  createNginxConfig,
  validateBootstrapHtml,
} from '../dist/index.js';

const DEFAULT_RUNTIME: AtlasHostRuntimeConfig = {
  schemaVersion: '1',
  hostId: 'customer-host',
  catalogUrl: 'https://cdn.example/atlas/hosts/customer-host/catalog.json',
  assetOrigins: ['https://assets.example'],
};

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
          runtime: DEFAULT_RUNTIME,
          ...(this.html === undefined ? {} : { html: this.html }),
        }).map((file) => [file.path, file.contents]),
      );
      return this;
    },
    createExternalFiles: (): IndexDriver => {
      this.files = new Map(
        createAtlasBootstrapFiles({
          runtimeConfig: 'external',
          ...(this.html === undefined ? {} : { html: this.html }),
        }).map((file) => [file.path, file.contents]),
      );
      return this;
    },
  };

  readonly get = {
    defaultRuntime: (): AtlasHostRuntimeConfig => DEFAULT_RUNTIME,
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
      assetOrigins: readonly string[] = DEFAULT_RUNTIME.assetOrigins ?? [],
    ): string => createNginxConfig(assetOrigins),
    runtime: (): AtlasHostRuntimeConfig =>
      JSON.parse(
        this.get.fileContents('atlas.runtime.json'),
      ) as AtlasHostRuntimeConfig,
    missingRuntimeError: (): string => {
      try {
        createAtlasBootstrapFiles({});
        return '';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  };
}
