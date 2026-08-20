import { beforeEach, describe, expect, it } from '@jest/globals';
import { PullRequestDriver } from './pull-request.driver.js';

describe('resolvePullRequestStatus', () => {
  let driver: PullRequestDriver;

  beforeEach(() => {
    driver = new PullRequestDriver();
  });

  it('should return open pull request when GitHub reports an open head', async () => {
    driver.given.github({ state: 'open' });

    await driver.when.resolve();

    expect(driver.get.status()).toStrictEqual(driver.get.expectedOpenStatus());
  });

  it('should authenticate request when GitHub token is configured', async () => {
    driver.given.github({ state: 'open' });

    await driver.when.resolve();

    expect(driver.get.request()).toStrictEqual(driver.get.expectedRequest());
  });

  it('should reject custom resolver when pull request head SHA is empty', async () => {
    driver.given.resolver({ headSha: 'empty' });

    await expect(driver.when.resolve()).rejects.toThrow(
      /invalid state or empty head SHA/,
    );
  });
});
