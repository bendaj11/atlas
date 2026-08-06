import { beforeEach, describe, expect, it } from '@jest/globals';
import { PullRequestStateDriver } from './pr-state-file.driver.js';

describe('readOpenPullRequests', () => {
  let driver: PullRequestStateDriver;

  beforeEach(() => {
    driver = new PullRequestStateDriver();
  });

  it('should reject when state completeness is missing', async () => {
    driver.given.state('incomplete');

    await expect(driver.when.read()).rejects.toThrow(/"complete": true/);
  });

  it('should return pull requests when state is complete', async () => {
    driver.given.state('complete');

    await driver.when.read();

    expect(driver.get.result()).toStrictEqual(
      driver.get.expectedPullRequests(),
    );
  });
});
