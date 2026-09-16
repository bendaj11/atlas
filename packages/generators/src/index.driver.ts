import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from './cli/generator-types.js';
import {
  generateAppFiles,
  generateHostFiles,
  generateWidgetFiles,
} from './index.js';
import { aGeneratorOptions } from './testkit/generator-options.testkit.js';

export class GeneratorsDriver {
  private options: AtlasGeneratorOptions = aGeneratorOptions();
  private files: AtlasGeneratedFile[] = [];

  readonly given = {
    options: (options: AtlasGeneratorOptions): this => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    hostGenerated: (): void => {
      this.files = generateHostFiles(this.options);
    },
    appGenerated: (): void => {
      this.files = generateAppFiles(this.options);
    },
    widgetGenerated: (): void => {
      this.files = generateWidgetFiles(this.options);
    },
  };

  readonly get = {
    paths: (): string[] => this.files.map((file) => file.path),
    contents: (path: string): string | undefined =>
      this.files.find((file) => file.path === path)?.contents,
  };
}
