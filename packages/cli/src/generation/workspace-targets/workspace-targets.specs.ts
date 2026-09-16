import { WorkspaceTargetsDriver } from './workspace-targets.driver.js';

describe('workspace-targets', () => {
  let driver: WorkspaceTargetsDriver;

  beforeEach(async () => {
    driver = new WorkspaceTargetsDriver();

    await driver.given.workspace();
  });

  describe('writeNxProject', () => {
    it('should write build, serve, dev, and atlas targets when an app is generated', async () => {
      driver.given.packageManager('pnpm');

      await driver.when.nxProjectWritten('apps/orders', 'orders', 'app');

      expect(await driver.get.projectJson('apps/orders')).toMatchObject({
        name: 'orders',
        sourceRoot: 'apps/orders/src',
        projectType: 'application',
        tags: ['atlas'],
        targets: {
          build: expect.any(Object),
          serve: expect.any(Object),
          dev: { options: { tty: true, forwardAllArgs: true } },
          'atlas:config': expect.any(Object),
          'atlas:publish': { cache: false },
          orders: { options: { command: 'nx run orders:dev' } },
        },
      });
    });

    it('should omit the bootstrap target when an app is generated', async () => {
      await driver.when.nxProjectWritten('apps/orders', 'orders', 'app');

      expect(
        (await driver.get.projectJson('apps/orders'))!.targets,
      ).not.toHaveProperty('atlas:bootstrap');
    });

    it('should add the bootstrap target when a host is generated', async () => {
      await driver.when.nxProjectWritten('apps/shell', 'shell', 'host');

      expect(await driver.get.projectJson('apps/shell')).toMatchObject({
        targets: {
          'atlas:bootstrap': {
            dependsOn: ['atlas:config'],
            outputs: ['{projectRoot}/dist/bootstrap'],
          },
        },
      });
    });
  });

  describe('ensureTurboTasks', () => {
    it('should leave the workspace untouched when turbo.json is absent', async () => {
      await driver.when.turboTasksEnsured();

      expect(await driver.get.turboJson()).toBeUndefined();
    });

    it('should add atlas tasks and keep an existing dev task when turbo.json declares tasks', async () => {
      await driver.given.turboJson({ tasks: { dev: { cache: true } } });

      await driver.when.turboTasksEnsured();

      expect(await driver.get.turboJson()).toMatchObject({
        tasks: {
          dev: { cache: true },
          'framework:dev': { cache: false, persistent: true },
          'atlas:config': { outputs: ['.atlas/**'] },
          'atlas:publish': { cache: false },
          'atlas:bootstrap': { dependsOn: ['atlas:config'] },
        },
      });
    });

    it('should write under pipeline when turbo.json uses the legacy key', async () => {
      await driver.given.turboJson({ pipeline: {} });

      await driver.when.turboTasksEnsured();

      expect(await driver.get.turboJson()).toMatchObject({
        pipeline: { 'atlas:config': { outputs: ['.atlas/**'] } },
      });
    });
  });
});
