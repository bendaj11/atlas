import { beforeEach, describe, expect, it } from '@jest/globals';
import { SharedModuleProxyDriver } from './shared-module-proxy.driver.js';

describe('shared module proxy', () => {
  let driver: SharedModuleProxyDriver;

  beforeEach(() => {
    driver = new SharedModuleProxyDriver();
  });

  it('should omit a default reexport when the transformed module has no default', async () => {
    driver.given.defaultExport(false);

    await driver.when.load();

    expect(driver.get.code()).not.toContain('export { default }');
  });

  it('should preserve the default when the transformed module exports one', async () => {
    driver.given.defaultExport(true);

    await driver.when.load();

    expect(driver.get.code()).toContain('export { default }');
  });

  it('should avoid inventing a default when export information is unavailable', async () => {
    driver.given.defaultExport(null);

    await driver.when.load();

    expect(driver.get.code()).not.toContain('export { default }');
  });

  it('should preserve named exports when CommonJS supplies synthetic bindings', async () => {
    driver.given.commonJsExports(['named']);

    await driver.when.load();

    expect(driver.get.code()).toContain('export { sharedExport0 as named };');
  });

  it('should avoid CommonJS guessing when Vite builds an ES module', async () => {
    await driver.when.load();

    expect(driver.get.commonJsReader()).not.toHaveBeenCalled();
  });

  it('should resolve from the app with Vite conditions when loading a shared package', async () => {
    await driver.when.load();

    expect(driver.get.resolutionRequest()).toEqual(
      driver.get.expectedResolutionRequest(),
    );
  });

  it('should report the missing dependency when Vite cannot resolve its entry', async () => {
    driver.given.unresolvedEntry(undefined);

    await expect(driver.when.load()).rejects.toThrow(
      'Atlas could not resolve shared dependency entry',
    );
  });

  it('should reject an external fallback when the entry cannot be bundled', async () => {
    driver.given.externalEntry('external:fixture');

    await expect(driver.when.load()).rejects.toThrow(
      'Atlas could not bundle shared dependency entry',
    );
  });

  it('should propagate the build error when a dependency transform rejects', async () => {
    driver.given.failedTransform('Invalid dependency syntax');

    await expect(driver.when.load()).rejects.toThrow(
      'Invalid dependency syntax',
    );
  });
});
