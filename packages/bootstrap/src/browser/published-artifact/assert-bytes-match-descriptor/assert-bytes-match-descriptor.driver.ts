import type { AtlasManifestDescriptor } from '@atlas/schema';
import { assertBytesMatchDescriptor } from './assert-bytes-match-descriptor.js';

export class AssertBytesMatchDescriptorDriver {
  private error: unknown;

  readonly when = {
    asserted: async (
      bytes: Uint8Array,
      descriptor: AtlasManifestDescriptor,
    ) => {
      try {
        await assertBytesMatchDescriptor(bytes, descriptor);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: () => this.error,
  };
}
