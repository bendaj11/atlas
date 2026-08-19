import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentSessionDriver } from './session.driver.js';

describe('development session', () => {
  let driver: DevelopmentSessionDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionDriver();
  });

  it('should deduplicate apps when local catalog is created', () => {
    driver.given.document('catalog');

    driver.when.createCatalog();

    expect(driver.get.value()).toStrictEqual(driver.get.catalog());
  });

  it('should retain catalog and override URL when dev session is created', () => {
    driver.given.document('session');

    driver.when.createSession();

    expect(driver.get.value()).toStrictEqual(driver.get.session());
  });

  it('should retain ready apps when their registration is refreshed', () => {
    driver.given.document('registration');

    driver.when.refreshRegistration();

    expect(driver.get.value()).toStrictEqual(driver.get.catalog());
  });

  it('should overlay local artifacts onto the published catalog when both exist', () => {
    driver.given.document('merged-catalog');

    driver.when.createMergedCatalog();

    expect(driver.get.value()).toStrictEqual(driver.get.mergedCatalog());
  });
});
