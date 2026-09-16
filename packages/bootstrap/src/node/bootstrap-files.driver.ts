import { createAtlasBootstrapFiles } from './bootstrap-files.js';
import type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from './bootstrap-types.js';

export class BootstrapFilesDriver {
  private options: AtlasBootstrapOptions = {};
  private files: AtlasBootstrapFile[] = [];
  private error: unknown;

  readonly given = {
    options: (options: AtlasBootstrapOptions): BootstrapFilesDriver => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      try {
        this.files = createAtlasBootstrapFiles(this.options);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    paths: (): string[] => this.files.map(({ path }) => path),
    contents: (path: AtlasBootstrapFile['path']): string | undefined =>
      this.files.find((file) => file.path === path)?.contents,
    error: (): unknown => this.error,
  };
}
