import { WorkspaceDriver } from './workspace.driver.js';

describe('detectWorkspace', () => {
  let driver: WorkspaceDriver;

  beforeEach(async () => {
    driver = new WorkspaceDriver();

    await driver.given.directory();
  });

  describe('when started inside an Nx workspace with yarn', () => {
    beforeEach(async () => {
      await driver.given.file('nx.json', {});
      await driver.given.file('package.json', {
        packageManager: 'yarn@1.22.22',
      });
      await driver.given.file('apps/orders/package.json', { name: 'orders' });

      await driver.when.detected('apps/orders');
    });

    it('should report nx kind when detected', () => {
      expect(driver.get.kind()).toBe('nx');
    });

    it('should report yarn when detected', () => {
      expect(driver.get.packageManager()).toBe('yarn');
    });

    it('should climb to the workspace root when detected', () => {
      expect(driver.get.root()).toBe('.');
    });

    it('should place generated projects under apps when detected', () => {
      expect(driver.get.generationRoot('app', 'catalog')).toBe('apps/catalog');
    });

    it('should report the missing Nx plugin when scaffold dependency is absent', async () => {
      expect(await driver.get.missingScaffoldDependency('angular')).toBe(
        '@nx/angular',
      );
    });

    it('should reject scaffolding when the project root escapes the workspace', async () => {
      await expect(driver.get.scaffoldProject('/outside')).rejects.toThrow(
        'Nx projects must be generated inside the workspace root.',
      );
    });
  });

  describe('when started inside a package workspace', () => {
    beforeEach(async () => {
      await driver.given.file('package.json', { workspaces: ['packages/*'] });
      await driver.given.file('packages/orders/package.json', {
        name: 'orders',
      });

      await driver.when.detected('packages/orders');
    });

    it('should report workspace kind when detected', () => {
      expect(driver.get.kind()).toBe('workspace');
    });

    it('should place generated projects under packages when detected', () => {
      expect(driver.get.generationRoot('app', 'catalog')).toBe(
        'packages/catalog',
      );
    });

    it('should report no missing scaffold dependency when detected', async () => {
      expect(
        await driver.get.missingScaffoldDependency('react'),
      ).toBeUndefined();
    });

    it('should not scaffold through Nx when detected', async () => {
      expect(await driver.get.scaffoldProject('packages/orders')).toBe(false);
    });
  });
});
