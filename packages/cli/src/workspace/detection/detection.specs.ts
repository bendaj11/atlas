import { faker } from '@faker-js/faker';
import { DetectionDriver } from './detection.driver.js';

const ROOT_MARKERS = [
  'nx.json',
  'turbo.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
];

describe('detection', () => {
  let driver: DetectionDriver;

  beforeEach(async () => {
    driver = new DetectionDriver();

    await driver.given.workspace();
  });

  describe('findWorkspaceRoot', () => {
    it.each(ROOT_MARKERS)(
      'should climb to the directory holding %s when started in a nested directory',
      async (marker) => {
        await driver.given.file(marker);
        await driver.given.subdirectory('apps/orders');

        expect(await driver.get.rootFrom('apps/orders')).toBe('.');
      },
    );

    it('should climb to the package declaring workspaces when no marker file exists', async () => {
      await driver.given.rootPackageJson({ workspaces: ['packages/*'] });
      await driver.given.subdirectory('packages/orders');

      expect(await driver.get.rootFrom('packages/orders')).toBe('.');
    });

    it('should return the start directory when no ancestor is a workspace root', async () => {
      await driver.given.subdirectory('apps/orders');

      expect(await driver.get.rootFrom('apps/orders')).toBe('apps/orders');
    });
  });

  describe('detectWorkspaceKind', () => {
    it('should return nx when nx.json exists', async () => {
      await driver.given.file('nx.json', '{}');

      expect(await driver.get.kind()).toBe('nx');
    });

    it('should return turbo when turbo.json exists', async () => {
      await driver.given.file('turbo.json', '{}');

      expect(await driver.get.kind()).toBe('turbo');
    });

    it('should return workspace when package.json declares workspaces', async () => {
      await driver.given.rootPackageJson({ workspaces: ['packages/*'] });

      expect(await driver.get.kind()).toBe('workspace');
    });

    it('should return workspace when pnpm-workspace.yaml exists', async () => {
      await driver.given.file(
        'pnpm-workspace.yaml',
        'packages:\n  - packages/*\n',
      );

      expect(await driver.get.kind()).toBe('workspace');
    });

    it('should return standalone when nothing declares a workspace', async () => {
      await driver.given.rootPackageJson({ name: faker.word.noun() });

      expect(await driver.get.kind()).toBe('standalone');
    });
  });

  describe('detectPackageManager', () => {
    it.each(['yarn', 'pnpm', 'npm'])(
      'should return %s when package.json declares it as packageManager',
      async (manager) => {
        await driver.given.rootPackageJson({
          packageManager: `${manager}@${faker.system.semver()}`,
        });

        expect(await driver.get.packageManager()).toBe(manager);
      },
    );

    it('should return pnpm when pnpm-lock.yaml exists', async () => {
      await driver.given.file('pnpm-lock.yaml');

      expect(await driver.get.packageManager()).toBe('pnpm');
    });

    it('should return yarn when yarn.lock exists', async () => {
      await driver.given.file('yarn.lock');

      expect(await driver.get.packageManager()).toBe('yarn');
    });

    it('should return npm when nothing declares a package manager', async () => {
      expect(await driver.get.packageManager()).toBe('npm');
    });
  });

  describe('detectGenerationBase', () => {
    it('should return the start directory when started one level below the root', async () => {
      await driver.given.subdirectory('services');

      expect(await driver.get.generationBaseFrom('services')).toBe('services');
    });

    it('should prefer the apps pattern when package.json declares several workspaces', async () => {
      await driver.given.rootPackageJson({
        workspaces: ['packages/*', 'apps/*'],
      });

      expect(await driver.get.generationBaseFrom('.')).toBe('apps');
    });

    it('should use the first wildcard pattern when no apps pattern exists', async () => {
      await driver.given.rootPackageJson({
        workspaces: { packages: ['libs/*', 'tools/*'] },
      });

      expect(await driver.get.generationBaseFrom('.')).toBe('libs');
    });

    it('should read pnpm-workspace.yaml when package.json declares no workspaces', async () => {
      await driver.given.file(
        'pnpm-workspace.yaml',
        "packages:\n  - 'packages/*'\n",
      );

      expect(await driver.get.generationBaseFrom('.')).toBe('packages');
    });

    it('should fall back to apps when no pattern is declared', async () => {
      expect(await driver.get.generationBaseFrom('.')).toBe('apps');
    });
  });
});
