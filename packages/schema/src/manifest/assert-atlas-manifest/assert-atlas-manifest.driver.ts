import { assertAtlasManifest } from './assert-atlas-manifest.js';

export class AssertAtlasManifestDriver {
  when = {
    asserted: (value: unknown) => {
      assertAtlasManifest(value);
    },
  };
}
