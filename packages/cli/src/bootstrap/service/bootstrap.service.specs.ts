import { beforeEach, describe, expect, it } from '@jest/globals';
import { AtlasBootstrapServiceDriver } from './bootstrap.service.driver.js';

describe('AtlasBootstrapService', () => {
  let driver: AtlasBootstrapServiceDriver;

  beforeEach(() => {
    driver = new AtlasBootstrapServiceDriver();
  });

  it('should return generated files and digest when build succeeds', async () => {
    driver.given.build({ flags: [] });

    await driver.when.build();

    expect(driver.get.buildSummary()).toStrictEqual({
      directory: driver.get.outputDirectory(),
      files: ['index.html', 'atlas.loader.js'],
      hasValidDigest: true,
    });
  });

  it('should compile configuration when skip-compile is absent', async () => {
    driver.given.build({ flags: [] });

    await driver.when.build();

    expect(driver.get.hasCompiledConfig()).toBe(true);
  });

  it('should not compile configuration when skip-compile is present', async () => {
    driver.given.build({ flags: ['--skip-compile'] });

    await driver.when.build();

    expect(driver.get.hasCompiledConfig()).toBe(false);
  });

  it('should pass customization when display flags are present', async () => {
    driver.given.build({ flags: [], customized: true });

    await driver.when.build();

    expect(driver.get.generatedOptions()).toStrictEqual(
      driver.get.expectedCustomOptions(),
    );
  });

});
