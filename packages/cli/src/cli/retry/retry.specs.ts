import { beforeEach, describe, expect, it } from '@jest/globals';
import { RetryDriver } from './retry.driver.js';

describe('withExponentialRetry', () => {
  let driver: RetryDriver;

  beforeEach(() => {
    driver = new RetryDriver();
  });

  it('should retry transient failures with exponential delays', async () => {
    driver.given.transientFailures(2);
    await driver.when.run();

    expect(driver.get.execution()).toStrictEqual({
      result: 'completed',
      attempts: 3,
      delays: [250, 500],
    });
  });

  it('should return permanent failure when request is not retryable', async () => {
    driver.given.permanentFailure();
    await driver.when.run();

    expect(driver.get.failure()).toStrictEqual({
      error: { $metadata: { httpStatusCode: 400 } },
      attempts: 1,
      delays: [],
    });
  });
});
