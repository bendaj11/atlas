import { createAtlasBootstrapFiles } from './bootstrap-files.js';
import type {
  AtlasBootstrapFile,
  AtlasBootstrapFilePath,
  AtlasBootstrapOptions,
} from '../bootstrap-types.js';

export class BootstrapFilesDriver {
  private options: AtlasBootstrapOptions = {};
  private files: AtlasBootstrapFile[] = [];
  private error: unknown;

  readonly given = {
    options: (options: AtlasBootstrapOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    created: () => {
      try {
        this.files = createAtlasBootstrapFiles(this.options);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    paths: () => this.files.map(({ path }) => path),
    contents: (path: AtlasBootstrapFilePath) =>
      this.files.find((file) => file.path === path)?.contents,
    error: () => this.error,
  };
}
