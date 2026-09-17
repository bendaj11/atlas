import { faker } from '@faker-js/faker';
import type { ProcessCommand } from '../../shared/index.js';
import type { AtlasPackageManager } from '../types.js';
import {
  buildPackageExecutorCommand,
  buildPackageScriptCommand,
  silenceCommandOutput,
} from './package-manager.js';

export class PackageManagerDriver {
  private manager: AtlasPackageManager = faker.helpers.arrayElement([
    'yarn',
    'pnpm',
    'npm',
  ]);
  private root = faker.system.directoryPath();
  private script = faker.word.noun();
  private args: string[] = [faker.word.noun()];

  readonly given = {
    manager: (manager: AtlasPackageManager) => {
      this.manager = manager;

      return this;
    },
    root: (root: string) => {
      this.root = root;

      return this;
    },
    script: (script: string) => {
      this.script = script;

      return this;
    },
    args: (args: string[]) => {
      this.args = args;

      return this;
    },
  };

  readonly get = {
    executorCommand: () =>
      buildPackageExecutorCommand({
        manager: this.manager,
        root: this.root,
        args: this.args,
      }),
    scriptCommand: () =>
      buildPackageScriptCommand({
        manager: this.manager,
        root: this.root,
        script: this.script,
        args: this.args,
      }),
    silenced: (command: ProcessCommand) => silenceCommandOutput(command),
  };
}
