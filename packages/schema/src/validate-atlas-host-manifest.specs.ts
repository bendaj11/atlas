import { beforeEach, describe, expect, it } from '@jest/globals';
import { HostManifestValidationDriver } from './validate-atlas-host-manifest.driver.js';

describe('validateAtlasHostManifest', () => {
  let driver: HostManifestValidationDriver;

  beforeEach(() => {
    driver = new HostManifestValidationDriver();
  });

  it('should accept headless app when id and path are valid', () => {
    driver.given.headlessApps([{ id: 'main-page', path: '/main' }]);
    driver.when.validate();

    expect(driver.get.issues()).toEqual([]);
  });

  it('should reject duplicate headless app paths when normalized paths match', () => {
    driver.given.headlessApps([
      { id: 'main-page', path: '/main' },
      { id: 'secondary-main-page', path: '/main/' },
    ]);
    driver.when.validate();

    expect(driver.get.issueMessage('headlessApps.1.path')).toBe(
      'Duplicate headless app path "/main".',
    );
  });
});
