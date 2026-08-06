import { beforeEach, describe, expect, it } from '@jest/globals';
import { VerifyServiceDriver } from './verify.service.driver.js';

describe('AtlasVerifyService', () => {
  let driver: VerifyServiceDriver;

  beforeEach(() => {
    driver = new VerifyServiceDriver();
  });

  it('should accept deployment when cross-origin resources are healthy', async () => {
    driver.given.deployment('healthy');

    await driver.when.run();

    expect(driver.get.healthyReport()).toStrictEqual(
      driver.get.healthyExpectation(),
    );
  });

  it('should reject catalog versions when one app has multiple selections', async () => {
    driver.given.deployment('multiple-versions');

    await driver.when.run();

    expect(driver.get.hasFailure('catalog versions')).toBe(true);
  });

  it('should reject integrity when asset digest does not match', async () => {
    driver.given.deployment('invalid-integrity');

    await driver.when.run();

    expect(driver.get.hasFailure('integrity')).toBe(true);
  });

  it('should explain ownership conflict when routes are duplicated', async () => {
    driver.given.deployment('duplicate-route');

    await driver.when.run();

    expect(driver.get.duplicateRouteMessage()).toMatch(
      /Duplicate routes:.*each hostId can use a path only once/s,
    );
  });

  it('should reject CORS when cross-origin headers are missing', async () => {
    driver.given.deployment('missing-cors');

    await driver.when.run();

    expect(driver.get.hasFailure('CORS')).toBe(true);
  });

  it('should accept deployment when catalog selects another asset origin', async () => {
    driver.given.deployment('selected-asset-origin');

    await driver.when.run();

    expect(driver.get.hasFailure('')).toBe(false);
  });

  it('should reject shared fallback when bundle is missing', async () => {
    driver.given.deployment('missing-shared-fallback');

    await driver.when.run();

    expect(driver.get.hasFailure('shared react')).toBe(true);
  });

  it('should reject federation metadata when shared details are incomplete', async () => {
    driver.given.deployment('incomplete-shared-metadata');

    await driver.when.run();

    expect(driver.get.hasFailure('federation metadata')).toBe(true);
  });

  it('should bound requests when network concurrency is configured', async () => {
    driver.given.deployment('request-concurrency');

    await driver.when.run();

    expect(driver.get.maximumConcurrency()).toBe(3);
  });

  it('should bound body reads when network concurrency is configured', async () => {
    driver.given.deployment('body-concurrency');

    await driver.when.run();

    expect(driver.get.maximumConcurrency()).toBe(2);
  });

  it('should abort request when configured timeout elapses', async () => {
    driver.given.deployment('timeout');

    await driver.when.run();

    expect(driver.get.requestAborted()).toBe(true);
  });

  it.each(['zero-timeout', 'infinite-timeout'] as const)(
    'should reject timeout when configured value is %s',
    async (scenario) => {
      driver.given.deployment(scenario);

      await expect(driver.when.run()).rejects.toThrow(/positive finite number/);
    },
  );

  it('should warn about cache when immutable max-age is zero', async () => {
    driver.given.deployment('zero-cache-age');

    await driver.when.run();

    expect(driver.get.hasWarning('remote entry cache')).toBe(true);
  });
});
