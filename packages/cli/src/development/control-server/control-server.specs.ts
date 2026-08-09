import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ControlServerDriver } from './control-server.driver.js';

describe('development control server', () => {
  let driver: ControlServerDriver;

  beforeEach(() => {
    driver = new ControlServerDriver();
  });

  afterEach(async () => {
    await driver.when.close();
  });

  it('should restore a running app when host control server restarts', async () => {
    await driver.given.runningHostAndApp();

    await driver.when.restartHostAndReconcileApp();

    expect(await driver.get.catalogAppIds()).toStrictEqual(driver.get.appIds());
  });
});
