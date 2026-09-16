import { assertAtlasManifest } from './assert-atlas-manifest.js';

export class AssertAtlasManifestDriver {
  when = {
    asserted: (value: unknown): void => {
      assertAtlasManifest(value);
    },
  };
}
