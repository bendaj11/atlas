/** @jest-environment jsdom */

import { HostOriginDriver } from './host-origin.driver.js';

describe('resolveDefaultHostOrigin', () => {
  let driver: HostOriginDriver;

  beforeEach(() => {
    driver = new HostOriginDriver();
  });

  it('should return the window origin when a browser window is present', () => {
    driver.when.originResolved();

    expect(driver.get.origin()).toBe(driver.get.windowOrigin());
  });
});
