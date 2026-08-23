import { beforeEach, describe, expect, it } from '@jest/globals';
import { PullRequestStateDriver } from './pr-state-file.driver.js';

describe('readOpenPreviews', () => {
  let driver: PullRequestStateDriver;

  beforeEach(() => {
    driver = new PullRequestStateDriver();
  });

  it('should reject when state completeness is missing', async () => {
    driver.given.state('incomplete');

    await expect(driver.when.read()).rejects.toThrow(/"complete": true/);
  });

  it('should return artifact preview scopes when state is complete', async () => {
    driver.given.state('complete');

    await driver.when.read();

    expect(driver.get.result()).toStrictEqual(driver.get.expectedState());
  });

  it('should reject duplicate artifact scopes when state is complete', async () => {
    driver.given.state('duplicate-artifact');

    await expect(driver.when.read()).rejects.toThrow(/"artifacts"/);
  });

  it('should reject unsafe artifact scope when state could escape its prefix', async () => {
    driver.given.state('unsafe-artifact');

    await expect(driver.when.read()).rejects.toThrow(/"artifacts"/);
  });
});
