import { faker } from '@faker-js/faker';
import type { AtlasPackageManager } from '../types.js';
import { PackageManagerDriver } from './package-manager.driver.js';

const ALL_MANAGERS: readonly AtlasPackageManager[] = ['yarn', 'pnpm', 'npm'];
const SEPARATING_MANAGERS: readonly AtlasPackageManager[] = ['pnpm', 'npm'];

describe('package-manager', () => {
  let driver: PackageManagerDriver;

  beforeEach(() => {
    driver = new PackageManagerDriver();
  });

  describe('buildPackageExecutorCommand', () => {
    it('should run the binary directly when the manager is yarn', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun(), faker.word.noun()];
      driver.given.manager('yarn').given.root(root).given.args(args);

      expect(driver.get.executorCommand()).toStrictEqual({
        command: 'yarn',
        args,
        cwd: root,
      });
    });

    it('should prefix exec when the manager is pnpm', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun()];
      driver.given.manager('pnpm').given.root(root).given.args(args);

      expect(driver.get.executorCommand()).toStrictEqual({
        command: 'pnpm',
        args: ['exec', ...args],
        cwd: root,
      });
    });

    it('should use npx when the manager is npm', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun()];
      driver.given.manager('npm').given.root(root).given.args(args);

      expect(driver.get.executorCommand()).toStrictEqual({
        command: 'npx',
        args,
        cwd: root,
      });
    });
  });

  describe('buildPackageScriptCommand', () => {
    it('should pass script arguments directly when the manager is yarn', () => {
      const root = faker.system.directoryPath();
      const script = faker.word.noun();
      const args = [faker.word.noun()];
      driver.given
        .manager('yarn')
        .given.root(root)
        .given.script(script)
        .given.args(args);

      expect(driver.get.scriptCommand()).toStrictEqual({
        command: 'yarn',
        args: ['run', script, ...args],
        cwd: root,
      });
    });

    it.each(SEPARATING_MANAGERS)(
      'should separate script arguments with -- when the manager is %s',
      (manager) => {
        const root = faker.system.directoryPath();
        const script = faker.word.noun();
        const args = [faker.word.noun()];
        driver.given
          .manager(manager)
          .given.root(root)
          .given.script(script)
          .given.args(args);

        expect(driver.get.scriptCommand()).toStrictEqual({
          command: manager,
          args: ['run', script, '--', ...args],
          cwd: root,
        });
      },
    );

    it.each(SEPARATING_MANAGERS)(
      'should omit the -- separator when there are no arguments and the manager is %s',
      (manager) => {
        const script = faker.word.noun();
        driver.given.manager(manager).given.script(script).given.args([]);

        expect(driver.get.scriptCommand().args).toStrictEqual(['run', script]);
      },
    );
  });

  describe('silenceCommandOutput', () => {
    it('should silence stdout and stdin while inheriting stderr when applied', () => {
      const command = {
        command: faker.helpers.arrayElement(ALL_MANAGERS),
        args: [faker.word.noun()],
        cwd: faker.system.directoryPath(),
      };

      expect(driver.get.silenced(command)).toStrictEqual({
        ...command,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });
  });
});
