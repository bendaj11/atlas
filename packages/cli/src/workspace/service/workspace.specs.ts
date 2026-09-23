import { faker } from '@faker-js/faker';
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
      await driver.given.file('apps/orders/package.json', {
        name: 'orders',
        version: '1.0.0',
      });
      await driver.given.sourceFile('apps/orders/atlas.config.ts', '');

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

    it('should skip formatting when no Nx formatter is installed', async () => {
      expect(await driver.get.formatGenerated('apps/orders')).toBe(false);
    });

    it('should run tasks through nx run when a task runs', async () => {
      const argument = `--${faker.word.noun()}`;

      await driver.when.taskRun('orders', 'build', [argument]);

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: ['nx', 'run', 'orders:build', argument],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should spawn tasks through nx run when a task is spawned', async () => {
      await driver.when.taskSpawned('orders', 'dev', []);

      expect(driver.get.spawnProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: ['nx', 'run', 'orders:dev'],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should install dependencies in the project when it has a package.json', async () => {
      await driver.when.dependenciesInstalled('apps/orders');

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: ['install'],
        cwd: driver.get.path('apps/orders'),
      });
    });

    it('should install dependencies at the workspace root when the project has no package.json', async () => {
      await driver.when.dependenciesInstalled('apps/catalog');

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: ['install'],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should add the Nx plugin when a scaffold dependency is installed', async () => {
      await driver.when.scaffoldDependencyInstalled('react');

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: ['nx', 'add', '@nx/react', '--interactive=false'],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should reject scaffolding when the project root escapes the workspace', async () => {
      await expect(
        driver.get.scaffoldProject({
          type: 'app',
          name: faker.word.noun(),
          framework: 'react',
          projectRoot: '/outside',
          devServerPort: faker.internet.port(),
          interactive: false,
          routing: false,
        }),
      ).rejects.toThrow(
        'Nx projects must be generated inside the workspace root.',
      );
    });

    it('should scaffold through nx generate when the project root is inside the workspace', async () => {
      const name = faker.word.noun();
      const port = faker.internet.port();

      await driver.get.scaffoldProject({
        type: 'app',
        name,
        framework: 'react',
        projectRoot: driver.get.path(`apps/${name}`),
        devServerPort: port,
        interactive: false,
        routing: true,
      });

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'yarn',
        args: [
          'nx',
          'generate',
          '@nx/react:application',
          `apps/${name}`,
          '--interactive=false',
          '--skipFormat',
          '--tags=atlas',
          '--routing=true',
          `--port=${port}`,
          '--e2eTestRunner=none',
          '--unitTestRunner=none',
          '--bundler=vite',
        ],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should report scaffolding when nx generate succeeds', async () => {
      const name = faker.word.noun();

      expect(
        await driver.get.scaffoldProject({
          type: 'app',
          name,
          framework: 'angular',
          projectRoot: driver.get.path(`apps/${name}`),
          devServerPort: faker.internet.port(),
          interactive: false,
          routing: false,
        }),
      ).toBe(true);
    });

    it('should name the missing plugin when nx generate fails', async () => {
      const name = faker.word.noun();
      driver.given.processFailure(new Error(faker.lorem.sentence()));

      await expect(
        driver.get.scaffoldProject({
          type: 'app',
          name,
          framework: 'angular',
          projectRoot: driver.get.path(`apps/${name}`),
          devServerPort: faker.internet.port(),
          interactive: false,
          routing: false,
        }),
      ).rejects.toThrow(
        `Nx could not scaffold "${name}". Install @nx/angular in the workspace and try again.`,
      );
    });
  });

  describe('when started inside a pnpm package workspace', () => {
    beforeEach(async () => {
      await driver.given.file('package.json', {
        packageManager: 'pnpm@9.0.0',
        workspaces: ['packages/*'],
      });
      await driver.given.file('packages/orders/package.json', {
        name: '@shop/orders',
        version: '1.0.0',
        scripts: { format: 'prettier --write .' },
      });
      await driver.given.sourceFile('packages/orders/atlas.config.ts', '');

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

    it('should not install a scaffold dependency when detected', async () => {
      await driver.when.scaffoldDependencyInstalled('react');

      expect(driver.get.runProcessMock()).not.toHaveBeenCalled();
    });

    it('should not scaffold through Nx when detected', async () => {
      expect(
        await driver.get.scaffoldProject({
          type: 'app',
          name: faker.word.noun(),
          framework: 'react',
          projectRoot: driver.get.path('packages/orders'),
          devServerPort: faker.internet.port(),
          interactive: false,
          routing: false,
        }),
      ).toBe(false);
    });

    it('should run tasks through pnpm --filter when a task runs', async () => {
      await driver.when.taskRun('@shop/orders', 'build', []);

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'pnpm',
        args: ['--filter', '@shop/orders', 'run', 'build'],
        cwd: driver.get.absoluteRoot(),
      });
    });

    it('should return the spawned child when a task is spawned', async () => {
      await driver.when.taskSpawned('@shop/orders', 'dev', []);

      expect(driver.get.spawnProcessMock()).toHaveReturnedWith(
        driver.get.spawnedChild(),
      );
    });

    it('should run the project format script silently when generated files are formatted', async () => {
      await driver.get.formatGenerated('packages/orders');

      expect(driver.get.runProcessMock()).toHaveBeenCalledWith({
        command: 'pnpm',
        args: ['run', 'format'],
        cwd: driver.get.path('packages/orders'),
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });

    it('should report formatting when the project has a format script', async () => {
      expect(await driver.get.formatGenerated('packages/orders')).toBe(true);
    });
  });
});
