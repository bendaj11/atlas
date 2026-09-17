import { faker } from '@faker-js/faker';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { aManifestDescriptor } from '../publication.testkit.js';
import { ValidateManifestDescriptorDriver } from './validate-manifest-descriptor.driver.js';

describe('assertManifestDescriptor', () => {
  let driver: ValidateManifestDescriptorDriver;

  beforeEach(() => {
    driver = new ValidateManifestDescriptorDriver();
  });

  it('should not throw when the descriptor is complete', () => {
    expect(() => driver.when.asserted(aManifestDescriptor())).not.toThrow();
  });

  it('should throw with the default subject when the value is not an object', () => {
    expect(() => driver.when.asserted(faker.lorem.word())).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        summary:
          'Invalid Atlas manifest descriptor. manifest descriptor: Expected manifest descriptor to be an object.',
      }),
    );
  });

  it('should prefix issues with the given subject when a subject is given', () => {
    expect(() =>
      driver.when.asserted(aManifestDescriptor({ size: 0 }), 'apps.0'),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        issues: [
          {
            path: 'apps.0.size',
            message: 'Expected size to be an integer of at least 1.',
          },
        ],
      }),
    );
  });

  it('should report path, digest and mediaType when they are invalid', () => {
    expect(() =>
      driver.when.asserted({
        ...aManifestDescriptor(),
        path: '../m.json',
        digest: 'sha256:x',
        mediaType: 'text/plain',
      }),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        issues: [
          {
            path: 'manifest descriptor.path',
            message: 'Expected "../m.json" to be a safe relative path.',
          },
          {
            path: 'manifest descriptor.digest',
            message:
              'Expected a lowercase SHA-256 digest such as sha256:<64 hex>.',
          },
          {
            path: 'manifest descriptor.mediaType',
            message: 'Expected mediaType to be "application/json".',
          },
        ],
      }),
    );
  });
});
