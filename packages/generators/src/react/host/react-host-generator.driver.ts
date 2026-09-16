import type { ReactVersionProfile } from '../../shared/versions/generator-versions.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  reactHostBootstrap,
  reactHostMain,
  reactHostSdkConfig,
} from './react-host-generator.js';

export class ReactHostGeneratorDriver {
  private profile: ReactVersionProfile = aReactVersionProfile();
  private contents!: string;

  readonly given = {
    profile: (profile: ReactVersionProfile): this => {
      this.profile = profile;

      return this;
    },
  };

  readonly when = {
    bootstrapGenerated: (): void => {
      this.contents = reactHostBootstrap(this.profile);
    },
    sdkConfigGenerated: (): void => {
      this.contents = reactHostSdkConfig();
    },
    mainGenerated: (): void => {
      this.contents = reactHostMain();
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}
