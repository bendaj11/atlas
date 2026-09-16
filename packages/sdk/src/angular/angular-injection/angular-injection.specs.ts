import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AngularInjectionDriver } from './angular-injection.driver.js';

describe('injectAtlasSdk', () => {
  let driver: AngularInjectionDriver;

  beforeEach(() => {
    driver = new AngularInjectionDriver();
  });

  afterEach(() => {
    driver.destroy();
  });

  it('should expose updated host data as a signal when the host data changes', () => {
    driver.given.hostData('initial').when.hostDataChanges('updated');

    expect(driver.get.userName()).toBe('updated');
  });

  it('should expose custom SDK functions when the SDK is injected', () => {
    driver.given.hostData('Ada');

    expect(driver.get.greeting()).toBe('Hello, Ada');
  });
});
