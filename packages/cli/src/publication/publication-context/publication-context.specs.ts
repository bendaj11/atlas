import { beforeEach, describe, expect, it } from '@jest/globals';
import { PublicationContextDriver } from './publication-context.driver.js';

describe('resolvePublicationContext', () => {
  let driver: PublicationContextDriver;

  beforeEach(() => {
    driver = new PublicationContextDriver();
  });

  it('should skip publication when branch has no pull request', () => {
    driver.given.publication('unmatched-branch');

    driver.when.resolve();

    expect(driver.get.skippedWithoutPullRequest()).toBe(true);
  });

  it('should publish when pull request number is explicit', () => {
    driver.given.publication('pull-request');

    driver.when.resolve();

    expect(driver.get.context()).toStrictEqual({ publish: true });
  });

  it('should fail when publication is required on unmatched branch', () => {
    driver.given.publication('required-branch');

    expect(driver.get.action()).toThrow(/Atlas expected a publication/);
  });
});
