import { beforeEach, describe, expect, it } from '@jest/globals';
import { AngularLocalRuntimeDriver } from './angular-local-runtime.driver.js';

describe('prepareAngularLocalRuntime', () => {
  let driver: AngularLocalRuntimeDriver;

  beforeEach(() => {
    driver = new AngularLocalRuntimeDriver();
  });

  it('should disable Angular development guards when local Angular app uses a production host', () => {
    driver.when.prepare();

    expect(driver.get.ngDevMode()).toBe(false);
  });

  it('should preserve existing Angular development mode when host already initialized Angular', () => {
    driver.given.ngDevMode(true).when.prepare();

    expect(driver.get.ngDevMode()).toBe(true);
  });

  it('should leave runtime unchanged when local app uses React', () => {
    driver.given.framework('react').when.prepare();

    expect(driver.get.hasNgDevMode()).toBe(false);
  });

  it('should leave runtime unchanged when Angular app uses a published channel', () => {
    driver.given.channel('production').when.prepare();

    expect(driver.get.hasNgDevMode()).toBe(false);
  });
});
