import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentSessionBackgroundDriver } from './development-session-background.driver.js';

describe('development session background bridge', () => {
  let driver: DevelopmentSessionBackgroundDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionBackgroundDriver();
  });

  it('should load matching development session from default control port', async () => {
    await driver.when.loaded();

    expect(driver.get.result()).toEqual(driver.get.session());
  });

  it('should bind development session request to preview URL', async () => {
    await driver.when.loaded();

    expect(driver.get.requestedPreviewUrl()).toBe(driver.get.previewUrl());
  });

  it('should use configured control port when custom port is provided', async () => {
    driver.given.customControlPort();

    await driver.when.loaded();

    expect(driver.get.requestedControlPort()).toBe('4512');
  });

  it('should reject development session when host does not match', async () => {
    driver.given.mismatchedSession();

    await driver.when.loaded();

    expect(driver.get.error()).toEqual(
      new Error('Atlas development session is invalid.'),
    );
  });
});
