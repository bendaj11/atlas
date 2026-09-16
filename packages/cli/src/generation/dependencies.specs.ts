import { DependenciesDriver } from './dependencies.driver.js';

describe('dependencies', () => {
  let driver: DependenciesDriver;

  beforeEach(async () => {
    driver = new DependenciesDriver();

    await driver.given.workspace();
  });

  describe('dependencyManifestPath', () => {
    it('should return the project package.json when the project declares one', async () => {
      await driver.given.packageJson('apps/orders/package.json', {});

      expect(await driver.get.manifestPath('apps/orders')).toBe(
        'apps/orders/package.json',
      );
    });

    it('should climb to the nearest package.json when the project has none', async () => {
      await driver.given.packageJson('package.json', {});
      await driver.given.directory('apps/orders');

      expect(await driver.get.manifestPath('apps/orders')).toBe('package.json');
    });

    it('should reject when no package.json exists up to the workspace root', async () => {
      await driver.given.directory('apps/orders');

      await expect(driver.get.manifestPath('apps/orders')).rejects.toThrow(
        /Could not find package.json for generated project/,
      );
    });
  });

  describe('existingFrameworkVersionInfo', () => {
    it('should return the react version and manifest when the manifest declares react', async () => {
      await driver.given.packageJson('apps/orders/package.json', {
        dependencies: { react: '19.1.0' },
      });

      expect(
        await driver.get.frameworkVersion('apps/orders', 'react'),
      ).toStrictEqual({
        version: '19.1.0',
        manifest: 'apps/orders/package.json',
      });
    });

    it('should read devDependencies when angular core is declared there', async () => {
      await driver.given.packageJson('package.json', {
        devDependencies: { '@angular/core': '20.0.0' },
      });
      await driver.given.directory('apps/shell');

      expect(
        (await driver.get.frameworkVersion('apps/shell', 'angular'))?.version,
      ).toBe('20.0.0');
    });

    it('should return undefined when the framework is not declared', async () => {
      await driver.given.packageJson('apps/orders/package.json', {
        dependencies: {},
      });

      expect(
        await driver.get.frameworkVersion('apps/orders', 'react'),
      ).toBeUndefined();
    });
  });

  describe('mergePackageDependencies', () => {
    it('should add missing dependencies sorted when the target lacks them', async () => {
      await driver.given.packageJson('package.json', {
        dependencies: { zod: '1.0.0' },
      });

      await driver.when.merged(
        'package.json',
        { dependencies: { '@atlas/sdk': '^1.0.0' } },
        'react',
      );

      expect(
        (await driver.get.packageJson('package.json'))!.dependencies,
      ).toStrictEqual({
        '@atlas/sdk': '^1.0.0',
        zod: '1.0.0',
      });
    });

    it('should return false when nothing changes', async () => {
      await driver.given.packageJson('package.json', {
        dependencies: { zod: '1.0.0' },
      });

      expect(
        await driver.when.merged(
          'package.json',
          { dependencies: { zod: '1.0.0' } },
          'react',
        ),
      ).toBe(false);
    });

    it('should keep an existing unmanaged version when the generated one differs', async () => {
      await driver.given.packageJson('package.json', {
        dependencies: { zod: '1.0.0' },
      });

      await driver.when.merged(
        'package.json',
        { dependencies: { zod: '2.0.0' } },
        'react',
      );

      expect(
        (await driver.get.packageJson('package.json'))!.dependencies,
      ).toStrictEqual({
        zod: '1.0.0',
      });
    });

    it('should align framework-managed versions when the target already has the framework', async () => {
      await driver.given.packageJson('package.json', {
        dependencies: { react: '18.0.0', 'react-dom': '18.0.0' },
      });

      await driver.when.merged(
        'package.json',
        { dependencies: { react: '19.0.0', 'react-dom': '19.0.0' } },
        'react',
      );

      expect(
        (await driver.get.packageJson('package.json'))!.dependencies,
      ).toStrictEqual({
        react: '19.0.0',
        'react-dom': '19.0.0',
      });
    });

    it('should leave framework-managed versions when the target has no framework yet', async () => {
      await driver.given.packageJson('package.json', {
        dependencies: { 'react-dom': '18.0.0' },
      });

      await driver.when.merged(
        'package.json',
        { dependencies: { 'react-dom': '19.0.0' } },
        'react',
      );

      expect(
        (await driver.get.packageJson('package.json'))!.dependencies,
      ).toStrictEqual({
        'react-dom': '18.0.0',
      });
    });
  });
});
