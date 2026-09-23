import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { aHostManifest } from '../host-manifest.testkit.js';
import { AssertAtlasHostManifestDriver } from './assert-atlas-host-manifest.driver.js';

describe('assertAtlasHostManifest', () => {
  let driver: AssertAtlasHostManifestDriver;

  beforeEach(() => {
    driver = new AssertAtlasHostManifestDriver();
  });

  it('should not throw when the host manifest is valid', () => {
    expect(() => driver.when.asserted(aHostManifest())).not.toThrow();
  });

  it('should throw AtlasValidationError naming the host manifest when it is invalid', () => {
    expect(() =>
      driver.when.asserted({ ...aHostManifest(), kind: 'app' }),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        name: 'AtlasValidationError',
        summary:
          'Invalid Atlas host manifest. kind: Expected kind to be "host".',
      }),
    );
  });
});
