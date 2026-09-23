import { assertManifestDescriptor } from './validate-manifest-descriptor.js';

export class ValidateManifestDescriptorDriver {
  when = {
    asserted: (value: unknown, subject?: string) => {
      assertManifestDescriptor(value, subject);
    },
  };
}
