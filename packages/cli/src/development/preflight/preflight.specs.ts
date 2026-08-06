import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentPreflightDriver } from './preflight.driver.js';

describe('assertUsableAngularBuildPackage', () => {
  let driver: DevelopmentPreflightDriver;

  beforeEach(() => {
    driver = new DevelopmentPreflightDriver();
  });

  it('should reject Angular build when compilation source is corrupt', async () => {
    await driver.given.angularBuild({ source: 'corrupt' });

    await expect(driver.when.validate()).rejects.toThrow(
      /@angular\/build.*corrupt.*creadConfiguration/,
    );
  });
});
