import { beforeEach, describe, expect, it } from '@jest/globals';
import { CatalogValidationDriver } from './catalog-validation.driver.js';

describe('validateHostCatalog', () => {
  let driver: CatalogValidationDriver;

  beforeEach(() => {
    driver = new CatalogValidationDriver();
  });

  it('should reject headless app id when selected app uses same id', () => {
    driver.given.headlessApp({ id: 'main-page', path: '/main' });
    driver.given.app({ id: 'main-page', path: '/orders' });
    driver.when.validate();

    expect(driver.get.issueMessage('host.headlessApps.0.id')).toBe(
      'Headless app id "main-page" conflicts with selected app id "main-page".',
    );
  });

  it('should reject headless app path when selected app owns path', () => {
    driver.given.headlessApp({ id: 'main-page', path: '/main' });
    driver.given.app({ id: 'orders-page', path: '/main' });
    driver.when.validate();

    expect(driver.get.issueMessage('host.headlessApps.0.path')).toBe(
      'Headless app path "/main" conflicts with a selected app route.',
    );
  });
});
