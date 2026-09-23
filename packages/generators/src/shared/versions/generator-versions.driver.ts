import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  extractExactSemver,
  resolveAngularVersionProfileFromOptions,
  resolveReactVersionProfileFromOptions,
} from './generator-versions.js';
import type {
  AngularVersionProfile,
  ReactVersionProfile,
} from './generator-versions.types.js';

export class GeneratorVersionsDriver {
  private options = aGeneratorOptions();
  private reactProfile!: ReactVersionProfile;
  private angularProfile!: AngularVersionProfile;
  private exactVersion: string | undefined;

  readonly given = {
    options: (options: AtlasGeneratorOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    reactProfileResolved: () => {
      this.reactProfile = resolveReactVersionProfileFromOptions(this.options);
    },
    angularProfileResolved: () => {
      this.angularProfile = resolveAngularVersionProfileFromOptions(
        this.options,
      );
    },
    exactSemverResolved: (version: string) => {
      this.exactVersion = extractExactSemver(version);
    },
  };

  readonly get = {
    reactProfile: () => this.reactProfile,
    angularProfile: () => this.angularProfile,
    exactVersion: () => this.exactVersion,
  };
}
