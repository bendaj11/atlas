import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './shared/types/generator-types.js';
import {
  generateAppFiles,
  generateHostFiles,
  generateWidgetFiles,
} from './index.js';
import { aGeneratorOptions } from './testkit/generator-options.testkit.js';

export class GeneratorsDriver {
  private options = aGeneratorOptions();
  private files: AtlasGeneratedFile[] = [];

  readonly given = {
    options: (options: AtlasGeneratorOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    hostGenerated: () => {
      this.files = generateHostFiles(this.options);
    },
    appGenerated: () => {
      this.files = generateAppFiles(this.options);
    },
    widgetGenerated: () => {
      this.files = generateWidgetFiles(this.options);
    },
  };

  readonly get = {
    paths: () => this.files.map((file) => file.path),
    contents: (path: string) =>
      this.files.find((file) => file.path === path)?.contents,
  };
}
