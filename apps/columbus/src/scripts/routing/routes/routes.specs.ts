import { beforeEach, describe, expect, it } from '@jest/globals';
import { RoutesDriver } from './routes.driver.js';

describe('routes', () => {
  let driver: RoutesDriver;

  beforeEach(() => {
    driver = new RoutesDriver();
  });

  it('should remain stable when artifact configuration uses router state', () => {
    expect(driver.get.artifactConfigurationRoute()).toBe('/artifact/edit');
  });
});
