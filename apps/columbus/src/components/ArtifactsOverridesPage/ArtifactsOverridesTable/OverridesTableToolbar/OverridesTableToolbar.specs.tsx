/** @jest-environment jsdom */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { OverridesTableToolbarDriver } from './OverridesTableToolbar.driver.js';

describe('overrides table toolbar', () => {
  let driver: OverridesTableToolbarDriver;

  beforeEach(() => {
    driver = new OverridesTableToolbarDriver();
  });

  it('should enable visible-artifact filtering when filter is off', async () => {
    driver.when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.visibleOnlyChange()).toBe(true);
  });

  it('should disable visible-artifact filtering when filter is on', async () => {
    driver.given.visibleOnly().when.rendered();

    await driver.when.visibleFilterClicked();

    expect(driver.get.visibleOnlyChange()).toBe(false);
  });
});
