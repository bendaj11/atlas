import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  assertValidGeneratorName,
  validateGeneratorOptions,
} from './validation.js';

export class ValidationDriver {
  private options: AtlasGeneratorOptions = aGeneratorOptions();

  readonly given = {
    options: (options: AtlasGeneratorOptions): this => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    validated: (): void => {
      validateGeneratorOptions(this.options);
    },
    nameValidated: (): void => {
      assertValidGeneratorName(this.options.name);
    },
  };
}
