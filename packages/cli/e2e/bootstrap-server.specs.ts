import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { BootstrapServerDriver } from './bootstrap-server.driver.js';

describe('local bootstrap server', () => {
  let driver: BootstrapServerDriver;

  beforeEach(() => {
    driver = new BootstrapServerDriver();
  });

  afterEach(async () => {
    await driver.when.close();
  });

  it('should return bootstrap metadata when metadata path is requested', async () => {
    await driver.given.server('static');

    await driver.when.request('/atlas.bootstrap.json');

    expect(await driver.get.runtimeHostId()).toBe(driver.get.expectedHostId());
  });

  it('should return bootstrap HTML when deep link is requested', async () => {
    await driver.given.server('static');

    await driver.when.request('/orders/42');

    expect(await driver.get.body()).toContain(driver.get.expectedHtml());
  });

  it('should return 404 when asset does not exist', async () => {
    await driver.given.server('static');

    await driver.when.request('/missing.js');

    expect(driver.get.status()).toBe(404);
  });

  it('should proxy request when native API route is configured', async () => {
    await driver.given.server('proxy');

    await driver.when.request('/api');

    expect(await driver.get.body()).toBe(driver.get.expectedUpstreamBody());
  });

  it('should proxy request when a native API route has a subpath', async () => {
    await driver.given.server('proxy');

    await driver.when.request('/api/data');

    expect(await driver.get.body()).toBe(driver.get.expectedUpstreamBody());
  });
});
