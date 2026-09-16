import { assertReleaseVersion } from './release-version.js';

export class ReleaseVersionDriver {
  when = {
    asserted: (value: unknown): void => {
      assertReleaseVersion(value);
    },
  };
}
