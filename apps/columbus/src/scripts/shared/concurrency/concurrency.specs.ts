import { ConcurrencyDriver } from './concurrency.driver';

describe('mapWithConcurrency', () => {
  let driver: ConcurrencyDriver;

  beforeEach(() => {
    driver = new ConcurrencyDriver();
  });

  it('should keep results in input order when operations run concurrently', async () => {
    await driver.when.mapped([1, 2, 3, 4], 2);

    expect(driver.get.results()).toEqual([2, 4, 6, 8]);
  });

  it('should never exceed the concurrency limit when there are more values than workers', async () => {
    await driver.when.mapped([1, 2, 3, 4, 5], 2);

    expect(driver.get.peakInFlight()).toBeLessThanOrEqual(2);
  });

  it('should return an empty list when there are no values', async () => {
    await driver.when.mapped([], 2);

    expect(driver.get.results()).toEqual([]);
  });
});
