import { expect, it } from '@jest/globals';
import { OverrideManifestsDriver } from './override-manifests.driver.js';

it('should include active new local app in catalog', () => {
  const driver = new OverrideManifestsDriver();

  driver.when.activeOverridesIncluded();

  expect(driver.get.catalogAppIds()).toEqual([driver.get.localAppId()]);
});
