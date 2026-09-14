import { aDeferredCount, BadgeRefreshDriver } from './badge-refresh.driver';

describe('createBadgeRefresher', () => {
  let driver: BadgeRefreshDriver;

  beforeEach(() => {
    driver = new BadgeRefreshDriver();
  });

  it('should publish the count when refreshed', async () => {
    await driver.given.counts(2).when.refreshed();

    expect(driver.get.publishedCounts()).toEqual([2]);
  });

  it('should publish the newest count when a refresh is queued during another', async () => {
    const firstRead = aDeferredCount();

    await driver.given
      .counts(firstRead, 2)
      .when.refreshedTwiceWhileFirstReadPends(firstRead, 1);

    expect(driver.get.publishedCounts()).toEqual([1, 2]);
  });

  it('should skip publishing when the count is unchanged', async () => {
    driver.given.counts(2, 2);

    await driver.when.refreshed();
    await driver.when.refreshed();

    expect(driver.get.publishedCounts()).toEqual([2]);
  });

  it('should keep the last published count when a read fails', async () => {
    driver.given.counts(2, new Error('temporary failure'));

    await driver.when.refreshed();
    await driver.when.refreshed();

    expect(driver.get.publishedCounts()).toEqual([2]);
  });
});

describe('countDevSessionOverrides', () => {
  let driver: BadgeRefreshDriver;

  beforeEach(() => {
    driver = new BadgeRefreshDriver();
  });

  it('should count apps and the host override when all are enabled', () => {
    driver.when.devSessionCounted({
      overrides: [{ appId: 'orders' }, { appId: 'dashboard' }],
      hostOverride: {},
    });

    expect(driver.get.count()).toBe(3);
  });

  it('should skip disabled apps when some are disabled', () => {
    driver.when.devSessionCounted(
      { overrides: [{ appId: 'orders' }, { appId: 'dashboard' }] },
      ['orders'],
    );

    expect(driver.get.count()).toBe(1);
  });

  it('should skip malformed overrides when entries lack an app id', () => {
    driver.when.devSessionCounted({
      overrides: [{ appId: 'orders' }, {}, null],
    });

    expect(driver.get.count()).toBe(1);
  });
});
