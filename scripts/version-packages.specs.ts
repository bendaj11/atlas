import { expect, test } from '@jest/globals';
import { VersionPackagesDriver } from './version-packages.driver.js';

test('should update every Atlas package when preparing a package release', async () => {
  const driver = new VersionPackagesDriver();
  await driver.given.releaseWorkspace('9.9.9');

  await driver.when.versionAtlasPackages('1.2.3');

  expect(await driver.get.atlasVersions()).toStrictEqual(['1.2.3']);
});

test('should preserve Columbus version when preparing a package release', async () => {
  const driver = new VersionPackagesDriver();
  await driver.given.releaseWorkspace('9.9.9');

  await driver.when.versionAtlasPackages('1.2.3');

  expect(await driver.get.columbusVersions()).toStrictEqual(['9.9.9']);
});
