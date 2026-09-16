import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { aSlotPlacement, anAppManifest } from '../manifest.testkit.js';
import { AssertAtlasManifestDriver } from './assert-atlas-manifest.driver.js';

describe('assertAtlasManifest', () => {
  let driver: AssertAtlasManifestDriver;

  beforeEach(() => {
    driver = new AssertAtlasManifestDriver();
  });

  it('should not throw when the manifest is valid', () => {
    expect(() => driver.when.asserted(anAppManifest())).not.toThrow();
  });

  it('should throw AtlasValidationError listing the issue and a suggested action when the manifest is invalid', () => {
    const { slot: _slot, ...placement } = aSlotPlacement();

    expect(() =>
      driver.when.asserted(anAppManifest({ placements: [placement] })),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        name: 'AtlasValidationError',
        message:
          'Invalid Atlas manifest. placements.0.slot: Expected slot to be a non-empty string. Suggested action: Correct every listed field in the Atlas JSON source, regenerate the artifact if generated, then retry.',
      }),
    );
  });
});
