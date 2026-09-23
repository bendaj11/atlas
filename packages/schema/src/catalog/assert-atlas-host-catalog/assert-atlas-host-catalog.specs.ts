import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { aHostCatalog } from '../catalog.testkit.js';
import { AssertAtlasHostCatalogDriver } from './assert-atlas-host-catalog.driver.js';

describe('assertAtlasHostCatalog', () => {
  let driver: AssertAtlasHostCatalogDriver;

  beforeEach(() => {
    driver = new AssertAtlasHostCatalogDriver();
  });

  it('should not throw when the catalog is valid', () => {
    expect(() => driver.when.asserted(aHostCatalog())).not.toThrow();
  });

  it('should throw AtlasValidationError with the issue when the catalog is invalid', () => {
    expect(() =>
      driver.when.asserted({ ...aHostCatalog(), apps: 'invalid' }),
    ).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        name: 'AtlasValidationError',
        issues: [
          { path: 'apps', message: 'Expected an array of app manifests.' },
        ],
      }),
    );
  });
});
