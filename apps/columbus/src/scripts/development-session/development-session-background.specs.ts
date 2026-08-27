import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentSessionBackgroundDriver } from './development-session-background.driver.js';

describe('development session background bridge', () => {
  let driver: DevelopmentSessionBackgroundDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionBackgroundDriver();
  });

  it('should stage matching session before navigating to clean preview', async () => {
    await driver.when.activated();

    expect(driver.get.activation()).toMatchObject({
      consumedUrl: expect.stringMatching(
        /^http:\/\/localhost:\d+\/atlas\.dev-session\/activate\/[A-Za-z0-9]+\/consume$/,
      ),
      navigatedUrl: expect.stringMatching(/^https?:\/\//),
      pendingCount: 1,
    });
  });

  it('should reject activation when sender is not loopback', async () => {
    await driver.when.activatedFromPublicOrigin();

    expect(driver.get.error()).toEqual(
      new Error('Atlas development activation must use loopback HTTP.'),
    );
  });

  it('should consume staged session when preview origin and host match', async () => {
    await driver.given.pendingActivation();
    await driver.when.consumed();

    expect(driver.get.consumedDocument()).toEqual(driver.get.session());
  });

  it('should discard staged session when preview origin differs', async () => {
    await driver.given.pendingActivation();
    await driver.when.consumedFromOtherOrigin();

    expect(driver.get.consumption()).toStrictEqual({
      document: undefined,
      pendingCount: 0,
    });
  });

  it('should discard staged session when activation expires', async () => {
    await driver.given.expiredPendingActivation();
    await driver.when.consumed();

    expect(driver.get.consumption()).toStrictEqual({
      document: undefined,
      pendingCount: 0,
    });
  });
});
