import { beforeEach, describe, expect, it } from '@jest/globals';
import { CliProcessDriver } from './process.driver.js';

describe('captureProcessOutput', () => {
  let driver: CliProcessDriver;

  beforeEach(() => {
    driver = new CliProcessDriver();
  });

  it('should combine process streams when output is captured', () => {
    driver.when.capture();

    expect(driver.get.capturedOutput()).toBe(driver.get.expectedOutput());
  });
});
