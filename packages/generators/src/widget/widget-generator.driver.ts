import { faker } from '@faker-js/faker';
import type { AtlasGeneratedFile } from '../shared/types/generator-types.js';
import type { SupportedGeneratorOptions } from '../shared/validation/validation.js';
import {
  anAngularGeneratorOptions,
  aReactGeneratorOptions,
} from '../testkit/generator-options.testkit.js';
import { generateWidgetFilesForFramework } from './widget-generator.js';

export class WidgetGeneratorDriver {
  private options = faker.helpers.arrayElement([
    anAngularGeneratorOptions(),
    aReactGeneratorOptions(),
  ]);
  private files: AtlasGeneratedFile[] = [];

  readonly given = {
    options: (options: SupportedGeneratorOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    generated: () => {
      this.files = generateWidgetFilesForFramework(this.options);
    },
  };

  readonly get = {
    paths: () => this.files.map((file) => file.path),
    contents: (path: string) =>
      this.files.find((file) => file.path === path)?.contents,
  };
}
