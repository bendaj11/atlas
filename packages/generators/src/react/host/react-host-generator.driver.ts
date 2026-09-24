import type { ReactVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { aReactVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  renderReactHostBootstrap,
  renderReactHostLayout,
  renderReactHostMain,
  renderReactHostSdkConfig,
} from './react-host-generator.js';

export class ReactHostGeneratorDriver {
  private profile = aReactVersionProfile();
  private contents!: string;

  readonly given = {
    profile: (profile: ReactVersionProfile) => {
      this.profile = profile;

      return this;
    },
  };

  readonly when = {
    bootstrapGenerated: () => {
      this.contents = renderReactHostBootstrap(this.profile);
    },
    layoutGenerated: () => {
      this.contents = renderReactHostLayout();
    },
    sdkConfigGenerated: () => {
      this.contents = renderReactHostSdkConfig();
    },
    mainGenerated: () => {
      this.contents = renderReactHostMain();
    },
  };

  readonly get = {
    contents: () => this.contents,
  };
}
