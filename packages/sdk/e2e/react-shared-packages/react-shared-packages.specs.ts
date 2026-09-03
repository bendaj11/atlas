import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  ReactSharedPackagesDriver,
  type PackageFormat,
} from './react-shared-packages.driver.js';

describe('React shared package production builds', () => {
  let driver: ReactSharedPackagesDriver;

  beforeEach(() => {
    driver = new ReactSharedPackagesDriver();
  });

  afterEach(async () => {
    await driver.when.cleanup();
  });

  it.each<PackageFormat>([
    'ESM without a package type',
    'declared ESM',
    'an mjs entry',
    'named star reexports',
    'a renamed default reexport',
    'a real default export',
    'a value reexported as default',
    'a namespace reexported as default',
    'a type-only default export',
    'CommonJS',
    'a cjs entry',
    'CommonJS reexports',
    'an import-only export map',
    'an import-only wildcard subpath',
    'different require and import entries',
    'a browser export condition',
    'a module field beside CommonJS main',
    'linked ESM without a package type',
    'linked CommonJS',
    'a plugin adding a default',
    'a plugin removing a default',
  ])(
    'should preserve runtime exports when the package uses %s',
    async (format) => {
      driver.given.packageFormat(format);

      await driver.when.build();

      expect(driver.get.exports()).toEqual(driver.get.expectedExports());
    },
  );

  it('should preserve exports when a host shares an ESM package without a type', async () => {
    driver.given
      .packageFormat('ESM without a package type')
      .given.consumer('host');

    await driver.when.build();

    expect(driver.get.exports()).toEqual(driver.get.expectedExports());
  });

  it('should retain singleton sharing when a linked package is bundled', async () => {
    driver.given.packageFormat('linked ESM without a package type');

    await driver.when.build();

    expect(driver.get.sharedSingleton()).toBe(true);
  });
});
