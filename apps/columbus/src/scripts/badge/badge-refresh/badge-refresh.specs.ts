import { faker } from '@faker-js/faker';
import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh';
import { BadgeRefreshDriver } from './badge-refresh.driver';

describe('createBadgeRefresher', () => {
  let driver: BadgeRefreshDriver;

  beforeEach(() => {
    driver = new BadgeRefreshDriver();
  });

  it('should publish the count when refreshed', async () => {
    const count = faker.number.int();
    const refresh = createBadgeRefresher({
      readCount: driver.get.readCount(),
      publishCount: driver.get.publishCount(),
    });

    driver.given.count(count);

    await refresh();

    expect(driver.get.publishCount()).toHaveBeenCalledWith(count);
  });

  it('should publish once when the count is unchanged between refreshes', async () => {
    const count = faker.number.int();
    const refresh = createBadgeRefresher({
      readCount: driver.get.readCount(),
      publishCount: driver.get.publishCount(),
    });

    driver.given.count(count).given.count(count);

    await refresh();
    await refresh();

    expect(driver.get.publishCount()).toHaveBeenCalledTimes(1);
  });

  it('should publish once when the second read fails', async () => {
    const refresh = createBadgeRefresher({
      readCount: driver.get.readCount(),
      publishCount: driver.get.publishCount(),
    });

    driver.given
      .count(faker.number.int())
      .given.countFailure(new Error(faker.lorem.sentence()));

    await refresh();
    await refresh();

    expect(driver.get.publishCount()).toHaveBeenCalledTimes(1);
  });

  it('should publish both counts in order when a refresh is queued while the first read pends', async () => {
    const firstCount = faker.number.int();
    const secondCount = faker.number.int();
    let resolveFirstRead: (count: number) => void = () => undefined;
    const refresh = createBadgeRefresher({
      readCount: driver.get.readCount(),
      publishCount: driver.get.publishCount(),
    });

    driver.given
      .countRead(
        new Promise((resolve) => {
          resolveFirstRead = resolve;
        }),
      )
      .given.count(secondCount);

    const first = refresh();
    const second = refresh();
    resolveFirstRead(firstCount);
    await Promise.all([first, second]);

    expect(driver.get.publishCount().mock.calls).toStrictEqual([
      [firstCount],
      [secondCount],
    ]);
  });
});

describe('countDevSessionOverrides', () => {
  it('should count the apps and the host override when all are enabled', () => {
    expect(
      countDevSessionOverrides({
        session: {
          overrides: [
            { appId: faker.string.uuid() },
            { appId: faker.string.uuid() },
          ],
          hostOverride: {},
        },
        disabledAppIds: new Set(),
      }),
    ).toBe(3);
  });

  it('should skip the disabled apps when some are disabled', () => {
    const disabledAppId = faker.string.uuid();

    expect(
      countDevSessionOverrides({
        session: {
          overrides: [{ appId: disabledAppId }, { appId: faker.string.uuid() }],
        },
        disabledAppIds: new Set([disabledAppId]),
      }),
    ).toBe(1);
  });

  it('should skip the malformed overrides when entries lack an app id', () => {
    expect(
      countDevSessionOverrides({
        session: { overrides: [{ appId: faker.string.uuid() }, {}, null] },
        disabledAppIds: new Set(),
      }),
    ).toBe(1);
  });
});
