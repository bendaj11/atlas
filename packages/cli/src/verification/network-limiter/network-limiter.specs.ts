import { NetworkLimiterDriver } from './network-limiter.driver.js';

describe('NetworkLimiter', () => {
  let driver: NetworkLimiterDriver;

  beforeEach(() => {
    driver = new NetworkLimiterDriver();
  });

  it('should never exceed the limit when more operations than slots run', async () => {
    driver.given.limit(2);

    await driver.when.operationsRun(6);

    expect(driver.get.peakConcurrency()).toBe(2);
  });

  it('should run every operation when the limit is one', async () => {
    driver.given.limit(1);

    await driver.when.operationsRun(3);

    expect(driver.get.peakConcurrency()).toBe(1);
  });

  it.each([0, 1.5, -1])('should throw when limit is %p', (limit) => {
    driver.given.limit(limit);

    expect(driver.get.construction()).toThrow(
      'Verification concurrency must be a positive integer.',
    );
  });
});
