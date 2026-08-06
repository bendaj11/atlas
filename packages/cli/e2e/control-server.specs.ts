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

  it('should update shared catalog when local app joins and leaves', async () => {
    await driver.when.coordinateApps();

    expect(driver.get.timeline()).toStrictEqual({
      departed: ['first'],
      initial: ['first'],
      joined: ['first', 'second'],
    });
  });
});
