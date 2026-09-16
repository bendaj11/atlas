import type {
  AtlasGeneratedFile,
  AtlasGeneratorOptions,
} from '../shared/types/generator-types.js';
import { aGeneratorOptions } from '../testkit/generator-options.testkit.js';
import type { SupportedGeneratorOptions } from '../shared/validation/validation.js';
import { generateWidgetFiles } from './widget-generator.js';

export class WidgetGeneratorDriver {
  private options: AtlasGeneratorOptions = aGeneratorOptions();
  private files: AtlasGeneratedFile[] = [];

  readonly given = {
    options: (options: AtlasGeneratorOptions): this => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    generated: (): void => {
      this.files = generateWidgetFiles(
        this.options as SupportedGeneratorOptions,
      );
    },
  };

  readonly get = {
    paths: (): string[] => this.files.map((file) => file.path),
    contents: (path: string): string | undefined =>
      this.files.find((file) => file.path === path)?.contents,
  };
}
