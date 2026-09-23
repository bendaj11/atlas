import { assertAtlasHostManifest } from './assert-atlas-host-manifest.js';

export class AssertAtlasHostManifestDriver {
  when = {
    asserted: (value: unknown) => {
      assertAtlasHostManifest(value);
    },
  };
}
