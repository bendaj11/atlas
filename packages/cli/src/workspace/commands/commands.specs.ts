import { faker } from '@faker-js/faker';
import { aProject } from '../workspace.testkit.js';
import { CommandsDriver } from './commands.driver.js';

const MANAGERS = ['yarn', 'pnpm', 'npm'] as const;
const TURBO_BYPASSED_TASKS = [
  'atlas:config',
  'dev',
  'framework:dev',
  'serve',
] as const;

describe('commands', () => {
  let driver: CommandsDriver;

  beforeEach(() => {
    driver = new CommandsDriver();
  });

  describe('createTaskCommand', () => {
    describe('when the workspace is nx', () => {
      beforeEach(() => {
        driver.given.kind('nx');
      });

      it.each([
        ['yarn', 'yarn', []],
        ['pnpm', 'pnpm', ['exec']],
        ['npm', 'npx', []],
      ] as const)(
        'should run nx through the %s executor when manager is %s',
        (manager, command, prefix) => {
          const project = aProject();
          driver.given.manager(manager);

          expect(
            driver.get.taskCommand(project, 'build', ['--x']),
          ).toStrictEqual({
            command,
            args: [...prefix, 'nx', 'run', `${project.id}:build`, '--x'],
            cwd: '/repo',
          });
        },
      );
    });

    describe('when the workspace is turbo', () => {
      beforeEach(() => {
        driver.given.kind('turbo');
      });

      it('should run the task through turbo when manager is pnpm', () => {
        const project = aProject();
        driver.given.manager('pnpm');

        expect(driver.get.taskCommand(project, 'build', ['--x'])).toStrictEqual(
          {
            command: 'pnpm',
            args: [
              'exec',
              'turbo',
              'run',
              'build',
              `--filter=${project.packageName}`,
              '--',
              '--x',
            ],
            cwd: '/repo',
          },
        );
      });

      it('should run turbo through yarn exec when manager is yarn', () => {
        const project = aProject();
        driver.given.manager('yarn');

        expect(driver.get.taskCommand(project, 'build')).toStrictEqual({
          command: 'yarn',
          args: [
            'exec',
            '--',
            'turbo',
            'run',
            'build',
            `--filter=${project.packageName}`,
          ],
          cwd: '/repo',
        });
      });

      it.each(TURBO_BYPASSED_TASKS)(
        'should bypass turbo and run the workspace task when task is %s',
        (task) => {
          const project = aProject();
          driver.given.manager('pnpm');

          expect(driver.get.taskCommand(project, task)).toStrictEqual({
            command: 'pnpm',
            args: ['--filter', project.packageName, 'run', task],
            cwd: '/repo',
          });
        },
      );
    });

    describe('when the workspace is a package workspace', () => {
      beforeEach(() => {
        driver.given.kind('workspace');
      });

      it('should run through yarn workspace when manager is yarn', () => {
        const project = aProject();
        driver.given.manager('yarn');

        expect(driver.get.taskCommand(project, 'build', ['--x'])).toStrictEqual(
          {
            command: 'yarn',
            args: ['workspace', project.packageName, 'run', 'build', '--x'],
            cwd: '/repo',
          },
        );
      });

      it('should run through pnpm filter when manager is pnpm', () => {
        const project = aProject();
        driver.given.manager('pnpm');

        expect(driver.get.taskCommand(project, 'build', ['--x'])).toStrictEqual(
          {
            command: 'pnpm',
            args: ['--filter', project.packageName, 'run', 'build', '--x'],
            cwd: '/repo',
          },
        );
      });

      it('should run through npm workspace with separated args when manager is npm', () => {
        const project = aProject();
        driver.given.manager('npm');

        expect(driver.get.taskCommand(project, 'build', ['--x'])).toStrictEqual(
          {
            command: 'npm',
            args: [
              'run',
              'build',
              '--workspace',
              project.packageName,
              '--',
              '--x',
            ],
            cwd: '/repo',
          },
        );
      });
    });

    it('should run the script in the project root when workspace is standalone', () => {
      const project = aProject();
      const manager = faker.helpers.arrayElement(MANAGERS);
      driver.given.kind('standalone').given.manager(manager);

      expect(
        driver.get.taskCommand(project, 'dev', ['--port', '1']),
      ).toStrictEqual({
        command: manager,
        args: ['run', 'dev', '--', '--port', '1'],
        cwd: project.root,
      });
    });
  });

  describe('createNxGenerationCommand', () => {
    it('should generate an Angular application with esbuild and style when framework is angular', () => {
      driver.given.manager('pnpm');

      expect(
        driver.get.nxGenerationCommand({
          framework: 'angular',
          type: 'host',
          directory: 'apps/shell',
          interactive: false,
          routing: true,
          stylesheetFormat: 'scss',
        }),
      ).toStrictEqual({
        command: 'pnpm',
        args: [
          'exec',
          'nx',
          'generate',
          '@nx/angular:application',
          'apps/shell',
          '--interactive=false',
          '--skipFormat',
          '--tags=atlas',
          '--routing=true',
          '--port=4200',
          '--ssr=false',
          '--style=scss',
          '--e2eTestRunner=none',
          '--unitTestRunner=none',
          '--bundler=esbuild',
        ],
        cwd: '/repo',
      });
    });

    it('should generate a React application with vite when framework is react', () => {
      driver.given.manager('yarn');

      expect(
        driver.get.nxGenerationCommand({
          framework: 'react',
          type: 'app',
          directory: 'apps/orders',
          interactive: false,
          routing: false,
        }),
      ).toStrictEqual({
        command: 'yarn',
        args: [
          'nx',
          'generate',
          '@nx/react:application',
          'apps/orders',
          '--interactive=false',
          '--skipFormat',
          '--tags=atlas',
          '--routing=false',
          '--port=4201',
          '--e2eTestRunner=none',
          '--unitTestRunner=none',
          '--bundler=vite',
        ],
        cwd: '/repo',
      });
    });

    it('should use the explicit port when devServerPort is given', () => {
      const port = faker.internet.port();

      expect(
        driver.get.nxGenerationCommand({
          framework: 'react',
          type: 'app',
          directory: 'apps/orders',
          devServerPort: port,
          interactive: false,
          routing: false,
        }).args,
      ).toContain(`--port=${port}`);
    });
  });

  describe('createNxPluginInstallCommand', () => {
    it.each([
      ['angular', '@nx/angular'],
      ['react', '@nx/react'],
    ] as const)(
      'should add %s plugin when project type is %s',
      (type, plugin) => {
        driver.given.manager('npm');

        expect(driver.get.nxPluginInstallCommand(type)).toStrictEqual({
          command: 'npx',
          args: ['nx', 'add', plugin, '--interactive=false'],
          cwd: '/repo',
        });
      },
    );
  });

  describe('createInstallCommand', () => {
    it('should install in the given root when manager is set', () => {
      const manager = faker.helpers.arrayElement(MANAGERS);
      const root = faker.system.directoryPath();
      driver.given.manager(manager);

      expect(driver.get.installCommand(root)).toStrictEqual({
        command: manager,
        args: ['install'],
        cwd: root,
      });
    });
  });

  describe('createFormatGeneratedCommand', () => {
    beforeEach(async () => {
      await driver.given.workspace();
    });

    it('should return undefined when nx workspace has no nx package', async () => {
      driver.given.kind('nx');

      expect(await driver.get.formatCommand('apps/orders')).toBeUndefined();
    });

    it('should run nx format:write quietly when nx workspace has nx installed', async () => {
      driver.given.kind('nx').given.manager('pnpm');
      await driver.given.workspaceFile('package.json', {
        devDependencies: { nx: '1.0.0' },
      });

      expect(await driver.get.formatCommand('apps/orders')).toStrictEqual({
        command: 'pnpm',
        args: ['exec', 'nx', 'format:write', 'apps/orders'],
        cwd: '.',
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });

    it('should run the project format script when the project declares one', async () => {
      driver.given.kind('workspace').given.manager('pnpm');
      await driver.given.workspaceFile('apps/orders/package.json', {
        scripts: { format: 'prettier --write .' },
      });

      expect(await driver.get.formatCommand('apps/orders')).toStrictEqual({
        command: 'pnpm',
        args: ['run', 'format'],
        cwd: 'apps/orders',
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });

    it('should run the project lint script with --fix when the project has lint only', async () => {
      driver.given.kind('workspace').given.manager('npm');
      await driver.given.workspaceFile('apps/orders/package.json', {
        scripts: { lint: 'eslint .' },
      });

      expect(await driver.get.formatCommand('apps/orders')).toStrictEqual({
        command: 'npm',
        args: ['run', 'lint', '--', '--fix'],
        cwd: 'apps/orders',
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });

    it('should run the workspace format script on the project when only the workspace declares one', async () => {
      driver.given.kind('workspace').given.manager('yarn');
      await driver.given.workspaceFile('package.json', {
        scripts: { format: 'prettier --write' },
      });

      expect(await driver.get.formatCommand('apps/orders')).toStrictEqual({
        command: 'yarn',
        args: ['run', 'format', 'apps/orders'],
        cwd: '.',
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });

    it('should return undefined when neither project nor workspace declares a script', async () => {
      driver.given.kind('workspace');

      expect(await driver.get.formatCommand('apps/orders')).toBeUndefined();
    });
  });

  describe('installationRoot', () => {
    beforeEach(async () => {
      await driver.given.workspace();
    });

    it('should return the project root when workspace is not nx', async () => {
      driver.given.kind('turbo');

      expect(await driver.get.installationRoot('apps/orders')).toBe(
        'apps/orders',
      );
    });

    it('should return the workspace root when nx project has no package.json', async () => {
      driver.given.kind('nx');

      expect(await driver.get.installationRoot('apps/orders')).toBe('.');
    });

    it('should return the project root when nx project has a package.json', async () => {
      driver.given.kind('nx');
      await driver.given.workspaceFile('apps/orders/package.json', {});

      expect(await driver.get.installationRoot('apps/orders')).toBe(
        'apps/orders',
      );
    });
  });

  describe('packageIsInstalled', () => {
    beforeEach(async () => {
      await driver.given.workspace();
    });

    it('should return true when the package exists in node_modules', async () => {
      await driver.given.workspaceFile(
        'node_modules/@nx/react/package.json',
        {},
      );

      expect(await driver.get.packageInstalled('@nx/react')).toBe(true);
    });

    it.each(['dependencies', 'devDependencies', 'optionalDependencies'])(
      'should return true when package.json lists it under %s',
      async (field) => {
        await driver.given.workspaceFile('package.json', {
          [field]: { '@nx/react': '1.0.0' },
        });

        expect(await driver.get.packageInstalled('@nx/react')).toBe(true);
      },
    );

    it('should return false when the package is neither installed nor declared', async () => {
      await driver.given.workspaceFile('package.json', {});

      expect(await driver.get.packageInstalled('@nx/react')).toBe(false);
    });
  });
});
