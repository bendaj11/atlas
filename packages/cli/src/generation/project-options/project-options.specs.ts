import { faker } from '@faker-js/faker';
import { ProjectOptionsDriver } from './project-options.driver.js';

describe('project-options', () => {
  let driver: ProjectOptionsDriver;

  beforeEach(() => {
    driver = new ProjectOptionsDriver();
  });

  describe('resolveInnerRouting', () => {
    it('should return true when type is host', async () => {
      expect(await driver.get.innerRouting('host')).toBe(true);
    });

    it('should honor --no-routing when given', async () => {
      driver.given.flags(['--no-routing']);

      expect(await driver.get.innerRouting('app')).toBe(false);
    });

    it('should default to true when not interactive', async () => {
      driver.given.interactive(false);

      expect(await driver.get.innerRouting('app')).toBe(true);
    });

    it('should return the prompted choice when interactive', async () => {
      driver.given.interactive(true).given.selection('false');

      expect(await driver.get.innerRouting('app')).toBe(false);
    });
  });

  describe('resolveStylesheetFormat', () => {
    it('should return undefined when framework is react', async () => {
      expect(await driver.get.stylesheetFormat('react')).toBeUndefined();
    });

    it('should honor --style when given', async () => {
      driver.given.flags(['--style=scss']);

      expect(await driver.get.stylesheetFormat('angular')).toBe('scss');
    });

    it('should default to css when not interactive', async () => {
      driver.given.interactive(false);

      expect(await driver.get.stylesheetFormat('angular')).toBe('css');
    });

    it('should return the prompted format when interactive', async () => {
      driver.given.interactive(true).given.selection('less');

      expect(await driver.get.stylesheetFormat('angular')).toBe('less');
    });
  });

  describe('resolveDevServerPort', () => {
    it('should honor --port when given', async () => {
      const port = faker.internet.port();
      driver.given.flags([`--port=${port}`]);

      expect(await driver.get.devServerPort('app')).toBe(port);
    });

    it('should suggest the default port when not interactive and no project uses it', async () => {
      driver.given.interactive(false);

      expect(await driver.get.devServerPort('host')).toBe(4200);
    });

    it('should re-prompt until a valid port is entered when interactive', async () => {
      driver.given.interactive(true).given.inputs(['abc', '70000', '4321']);

      expect(await driver.get.devServerPort('app')).toBe(4321);
    });
  });

  describe('ensureWorkspaceGenerator', () => {
    it('should skip when --skip-workspace-generator is given', async () => {
      driver.given
        .flags(['--skip-workspace-generator'])
        .given.missingScaffoldDependency('@nx/react');

      await driver.get.workspaceGeneratorEnsured('react');

      expect(driver.get.installScaffoldDependencyMock()).not.toHaveBeenCalled();
    });

    it('should install the plugin when --yes is given and it is missing', async () => {
      driver.given
        .flags(['--yes'])
        .given.missingScaffoldDependency('@nx/react');

      await driver.get.workspaceGeneratorEnsured('react');

      expect(driver.get.installScaffoldDependencyMock()).toHaveBeenCalledWith(
        'react',
      );
    });

    it('should reject when the plugin is missing and not interactive', async () => {
      driver.given
        .interactive(false)
        .given.missingScaffoldDependency('@nx/angular');

      await expect(
        driver.get.workspaceGeneratorEnsured('angular'),
      ).rejects.toThrow(
        '@nx/angular is not installed. Re-run with --yes to let Atlas add it automatically.',
      );
    });

    it('should reject when the user declines the install interactively', async () => {
      driver.given
        .interactive(true)
        .given.selection('no')
        .given.missingScaffoldDependency('@nx/react');

      await expect(
        driver.get.workspaceGeneratorEnsured('react'),
      ).rejects.toThrow('@nx/react is required to generate this Nx project.');
    });

    it('should install when the user accepts interactively', async () => {
      driver.given
        .interactive(true)
        .given.selection('yes')
        .given.missingScaffoldDependency('@nx/react');

      await driver.get.workspaceGeneratorEnsured('react');

      expect(driver.get.installScaffoldDependencyMock()).toHaveBeenCalledWith(
        'react',
      );
    });
  });
});
