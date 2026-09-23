/** @jest-environment node */

import { HostOriginDriver } from './host-origin.driver.js';

describe('resolveDefaultHostOrigin', () => {
  let driver: HostOriginDriver;

  beforeEach(() => {
    driver = new HostOriginDriver();
  });

  it('should return the localhost fallback when no browser window is present', () => {
    driver.when.originResolved();

    expect(driver.get.origin()).toBe('http://localhost');
  });
});
