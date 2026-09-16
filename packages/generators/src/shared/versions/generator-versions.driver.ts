import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  angularVersionProfile,
  exactSemver,
  reactVersionProfile,
  type AngularVersionProfile,
  type ReactVersionProfile,
} from './generator-versions.js';

export class GeneratorVersionsDriver {
  private options: AtlasGeneratorOptions = aGeneratorOptions();
  private reactProfile!: ReactVersionProfile;
  private angularProfile!: AngularVersionProfile;
  private exactVersion: string | undefined;

  readonly given = {
    options: (options: AtlasGeneratorOptions): this => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    reactProfileResolved: (): void => {
      this.reactProfile = reactVersionProfile(this.options);
    },
    angularProfileResolved: (): void => {
      this.angularProfile = angularVersionProfile(this.options);
    },
    exactSemverResolved: (version: string): void => {
      this.exactVersion = exactSemver(version);
    },
  };

  readonly get = {
    reactProfile: (): ReactVersionProfile => this.reactProfile,
    angularProfile: (): AngularVersionProfile => this.angularProfile,
    exactVersion: (): string | undefined => this.exactVersion,
  };
}
