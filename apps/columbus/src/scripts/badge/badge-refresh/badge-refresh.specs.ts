import { beforeEach, describe, expect, it } from '@jest/globals';
import { BadgeRefreshDriver } from './badge-refresh.driver.js';

describe('badge refresh queue', () => {
  let driver: BadgeRefreshDriver;

  beforeEach(() => {
    driver = new BadgeRefreshDriver();
  });

  it('should publish newest count when refresh is queued', async () => {
    const firstCount = driver.deferredCount();
    driver.given
      .countReads(
        () => firstCount.promise,
        async () => 2,
      )
      .when.refresherCreated();

    await driver.when.refreshedTwiceConcurrently(firstCount);

    expect(driver.get.publishedCounts()).toStrictEqual([1, 2]);
  });

  it('should suppress duplicate publication when count is unchanged', async () => {
    driver.given
      .countReads(
        async () => 2,
        async () => 2,
      )
      .when.refresherCreated();

    await driver.when.refreshed();
    await driver.when.refreshed();

    expect(driver.get.publishedCounts()).toStrictEqual([2]);
  });

  it('should preserve published count when next read fails', async () => {
    driver.given
      .countReads(
        async () => 2,
        async () => Promise.reject(new Error('temporary failure')),
      )
      .when.refresherCreated();

    await driver.when.refreshed();
    await driver.when.refreshed();

    expect(driver.get.publishedCounts()).toStrictEqual([2]);
  });
});

describe('development badge count', () => {
  let driver: BadgeRefreshDriver;

  beforeEach(() => {
    driver = new BadgeRefreshDriver();
  });

  it('should include host override when session has host override', () => {
    expect(driver.get.overrideCount()).toBe(3);
  });

  it('should exclude disabled app override when app is disabled', () => {
    expect(driver.get.overrideCount(new Set(['orders']))).toBe(2);
  });
});
