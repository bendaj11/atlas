import { beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigCompilerDriver } from './config-compiler.driver.js';

describe('compileAtlasConfig', () => {
  let driver: ConfigCompilerDriver;

  beforeEach(() => {
    driver = new ConfigCompilerDriver();
  });

  it('should emit config when project tsconfig disables output', async () => {
    await driver.given.project('project-tsconfig');

    await driver.when.compile();

    expect(driver.get.emittedConfig()).toBe(true);
  });

  it('should emit config when app tsconfig overrides project tsconfig', async () => {
    await driver.given.project('app-tsconfig');

    await driver.when.compile();

    expect(driver.get.emittedConfig()).toBe(true);
  });

  it('should reject when project has no TypeScript config', async () => {
    await driver.given.project('missing-tsconfig');

    await expect(driver.when.compile()).rejects.toThrow(
      'Could not find tsconfig.app.json or tsconfig.json',
    );
  });

  it('should reject when TypeScript config is invalid', async () => {
    await driver.given.project('invalid-tsconfig');

    await expect(driver.when.compile()).rejects.toThrow();
  });

  it('should reject when Atlas config has TypeScript errors', async () => {
    await driver.given.project('invalid-atlas-config');

    await expect(driver.when.compile()).rejects.toThrow(/missingConfig/);
  });
});
