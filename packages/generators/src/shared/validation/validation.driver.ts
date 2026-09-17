import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  assertValidGeneratorName,
  validateGeneratorOptions,
} from './validation.js';

export class ValidationDriver {
  private options = aGeneratorOptions();

  readonly given = {
    options: (options: AtlasGeneratorOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    validated: () => {
      validateGeneratorOptions(this.options);
    },
    nameValidated: () => {
      assertValidGeneratorName(this.options.name);
    },
  };
}
