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
});
