import { faker } from '@faker-js/faker';
import type { AtlasPackageManager } from '../types.js';
import {
  buildPackageExecutorCommand,
  buildPackageScriptCommand,
  silenceCommandOutput,
} from './package-manager.js';

const ALL_MANAGERS: readonly AtlasPackageManager[] = ['yarn', 'pnpm', 'npm'];

describe('package-manager', () => {
  describe('packageExecutor', () => {
    it('should run the binary directly when the manager is yarn', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun(), faker.word.noun()];

      expect(
        buildPackageExecutorCommand({ manager: 'yarn', root, args }),
      ).toStrictEqual({
        command: 'yarn',
        args,
        cwd: root,
      });
    });

    it('should prefix exec when the manager is pnpm', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun()];

      expect(
        buildPackageExecutorCommand({ manager: 'pnpm', root, args }),
      ).toStrictEqual({
        command: 'pnpm',
        args: ['exec', ...args],
        cwd: root,
      });
    });

    it('should use npx when the manager is npm', () => {
      const root = faker.system.directoryPath();
      const args = [faker.word.noun()];

      expect(
        buildPackageExecutorCommand({ manager: 'npm', root, args }),
      ).toStrictEqual({
        command: 'npx',
        args,
        cwd: root,
      });
    });
  });

  describe('packageScript', () => {
    it('should pass script arguments directly when the manager is yarn', () => {
      const root = faker.system.directoryPath();
      const script = faker.word.noun();
      const args = [faker.word.noun()];

      expect(
        buildPackageScriptCommand({ manager: 'yarn', root, script, args }),
      ).toStrictEqual({
        command: 'yarn',
        args: ['run', script, ...args],
        cwd: root,
      });
    });

    it.each(['pnpm', 'npm'] as const)(
      'should separate script arguments with -- when the manager is %s',
      (manager) => {
        const root = faker.system.directoryPath();
        const script = faker.word.noun();
        const args = [faker.word.noun()];

        expect(
          buildPackageScriptCommand({ manager, root, script, args }),
        ).toStrictEqual({
          command: manager,
          args: ['run', script, '--', ...args],
          cwd: root,
        });
      },
    );

    it.each(['pnpm', 'npm'] as const)(
      'should omit the -- separator when there are no arguments and the manager is %s',
      (manager) => {
        const root = faker.system.directoryPath();
        const script = faker.word.noun();

        expect(
          buildPackageScriptCommand({ manager, root, script, args: [] }).args,
        ).toStrictEqual(['run', script]);
      },
    );
  });

  describe('quietCommand', () => {
    it('should silence stdout and stdin while inheriting stderr when applied', () => {
      const command = {
        command: faker.helpers.arrayElement(ALL_MANAGERS),
        args: [faker.word.noun()],
        cwd: faker.system.directoryPath(),
      };

      expect(silenceCommandOutput(command)).toStrictEqual({
        ...command,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
    });
  });
});
