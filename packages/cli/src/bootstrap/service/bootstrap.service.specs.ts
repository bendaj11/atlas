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
      files: ['index.html', 'atlas.loader.js', 'atlas.bootstrap.json'],
      hasValidDigest: true,
    });
  });

  it('should compile configuration when skip-compile is absent', async () => {
    driver.given.build({ flags: [] });

    await driver.when.build();

    expect(driver.get.hasCompiledConfig()).toBe(true);
  });

  it('should omit runtime configuration when external runtime mode is requested', async () => {
    driver.given.build({ flags: ['--runtime-config=external'] });

    await driver.when.build();

    expect(driver.get.generatedOptions()).toStrictEqual({
      runtimeConfig: 'external',
    });
  });

  it('should reject when runtime configuration mode is unsupported', async () => {
    driver.given.build({ flags: ['--runtime-config=remote'] });

    await expect(driver.when.build()).rejects.toThrow(
      '--runtime-config must be embedded or external',
    );
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

  it('should write sorted metadata when build succeeds', async () => {
    driver.given.build({ flags: [] });

    await driver.when.build();

    expect(driver.get.metadata()).toBe(
      `${JSON.stringify(
        {
          schemaVersion: '1',
          digest: driver.get.result().digest,
          files: ['atlas.loader.js', 'index.html'],
        },
        null,
        2,
      )}\n`,
    );
  });

  it('should reject when build configuration cannot load', async () => {
    const error = new Error('configuration unavailable');

    driver.given.build({ flags: [], configError: error });

    await expect(driver.when.build()).rejects.toThrow(error);
  });

  it('should write runtime configuration when rendering succeeds', async () => {
    driver.given.build({ flags: [] });

    await driver.when.renderRuntimeConfig();

    expect(driver.get.renderedRuntime()).toStrictEqual(driver.get.runtime());
  });
});
