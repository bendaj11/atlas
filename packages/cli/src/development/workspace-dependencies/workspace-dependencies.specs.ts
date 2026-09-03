import { beforeEach, describe, expect, it } from '@jest/globals';
import { WorkspaceDependenciesDriver } from './workspace-dependencies.driver.js';

describe('warnWorkspaceDependencies', () => {
  let driver: WorkspaceDependenciesDriver;

  beforeEach(() => {
    driver = new WorkspaceDependenciesDriver();
  });

  it.each([
    'workspace:*',
    'workspace:^',
    'workspace:~',
    'workspace:^1.2.3',
    'workspace:../lib',
    'workspace:alias@*',
  ])(
    'should name local packages when dependency range is %s',
    async (version) => {
      driver.given.dependency(version);

      await driver.when.check();

      expect(driver.get.message()).toContain(driver.get.packageName());
    },
  );

  it.each([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ])('should warn when workspace packages appear in %s', async (group) => {
    driver.given.dependency('workspace:*', group);

    await driver.when.check();

    expect(driver.get.warnings()).toHaveLength(1);
  });

  it('should explain local bundling and rebuilds when React uses workspace packages', async () => {
    driver.given.dependency('workspace:*');

    await driver.when.check('react');

    expect(driver.get.warnings()).toEqual([
      `Local workspace dependencies detected in ${driver.get.packagePath()}: ${driver.get.packageName()}.\n` +
        'For packages you edit locally and import at runtime, ensure "skip" in the createReactAppViteConfig or createReactHostViteConfig options in this project\'s vite.config.ts covers their names and imported subpaths. This lets the framework bundle local code instead of loading a shared federation copy that may hide your changes.\n' +
        'Restart atlas dev after changing this configuration. If a package exports compiled files, run its build watcher too. Keep packages that require a shared singleton out of "skip".',
    ]);
  });

  it('should identify Angular federation configs when Angular uses workspace packages', async () => {
    driver.given.dependency('workspace:^');

    await driver.when.check('angular');

    expect(driver.get.message()).toContain(
      '"skip" in the Atlas federation options in this project\'s federation.config.js or federation.config.mjs',
    );
  });

  it('should remain silent when framework has no supported skip guidance', async () => {
    driver.given.dependency('workspace:*');

    await driver.when.check('vue');

    expect(driver.get.warnings()).toEqual([]);
  });

  it('should list each package once when declared in multiple dependency groups', async () => {
    driver.given.duplicateDependency('workspace:*');

    await driver.when.check();

    expect(driver.get.summary()).toBe(
      `Local workspace dependencies detected in ${driver.get.packagePath()}: ${driver.get.packageName()}.`,
    );
  });

  it('should list only local packages when registry dependencies are also declared', async () => {
    driver.given.mixedDependencies('workspace:*');

    await driver.when.check();

    expect(driver.get.summary()).toBe(
      `Local workspace dependencies detected in ${driver.get.packagePath()}: ${driver.get.packageName()}.`,
    );
  });

  it.each(['^1.2.3', 'latest', 'npm:library@1.0.0', 123, null])(
    'should remain silent when dependency version is %s',
    async (version) => {
      driver.given.dependency(version);

      await driver.when.check();

      expect(driver.get.warnings()).toEqual([]);
    },
  );

  it('should remain silent when no dependency groups exist', async () => {
    await driver.when.check();

    expect(driver.get.warnings()).toEqual([]);
  });

  it('should remain silent when project has no package.json', async () => {
    driver.given.packageReadFailure('ENOENT');

    await driver.when.check();

    expect(driver.get.warnings()).toEqual([]);
  });

  it('should surface read failure when package.json is inaccessible', async () => {
    driver.given.packageReadFailure('EACCES');

    await expect(driver.when.check()).rejects.toThrow(
      'Cannot read package.json',
    );
  });

  it('should surface invalid manifest when package.json is malformed', async () => {
    driver.given.invalidPackageJson('{');

    await expect(driver.when.check()).rejects.toThrow(SyntaxError);
  });
});
