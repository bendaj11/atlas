/** @jest-environment node */

import { HostOriginServerDriver } from './host-origin-server.driver.js';

describe('resolveDefaultHostOrigin', () => {
  let driver: HostOriginServerDriver;

  beforeEach(() => {
    driver = new HostOriginServerDriver();
  });

  it('should return the localhost fallback when no browser window is present', () => {
    driver.when.originResolved();

    expect(driver.get.origin()).toBe('http://localhost');
  });
});
