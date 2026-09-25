import { faker } from '@faker-js/faker';
import { createBadgeRefresher } from './badge-refresh';
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
