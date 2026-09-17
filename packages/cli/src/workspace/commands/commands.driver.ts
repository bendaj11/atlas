import { relative } from 'node:path';
import type {
  AtlasNxProjectType,
  AtlasPackageManager,
  AtlasProject,
  AtlasTask,
  AtlasWorkspaceKind,
} from '../types.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  createFormatGeneratedCommand,
  createInstallCommand,
  createNxGenerationCommand,
  createNxPluginInstallCommand,
  createTaskCommand,
  installationRoot,
  packageIsInstalled,
  type NxGenerationOptions,
} from './commands.js';
import type { ProcessCommand } from '../../shared/index.js';

export class CommandsDriver {
  private readonly directory = new TemporaryDirectory();
  private kind: AtlasWorkspaceKind = 'standalone';
  private manager: AtlasPackageManager = 'npm';

  readonly given = {
    kind: (kind: AtlasWorkspaceKind): this => {
      this.kind = kind;

      return this;
    },
    manager: (manager: AtlasPackageManager): this => {
      this.manager = manager;

      return this;
    },
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-commands-');

      return this;
    },
    workspaceFile: async (
      relativePath: string,
      value: unknown,
    ): Promise<this> => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
  };

  readonly get = {
    taskCommand: (
      project: AtlasProject,
      task: AtlasTask,
      args?: string[],
    ): ProcessCommand =>
      createTaskCommand({
        kind: this.kind,
        manager: this.manager,
        root: '/repo',
        project,
        task,
        args,
      }),
    nxGenerationCommand: (generation: NxGenerationOptions): ProcessCommand =>
      createNxGenerationCommand({
        manager: this.manager,
        root: '/repo',
        generation,
      }),
    nxPluginInstallCommand: (projectType: AtlasNxProjectType): ProcessCommand =>
      createNxPluginInstallCommand({
        manager: this.manager,
        root: '/repo',
        projectType,
      }),
    installCommand: (projectRoot: string): ProcessCommand =>
      createInstallCommand({ manager: this.manager, projectRoot }),
    formatCommand: async (
      projectRoot: string,
    ): Promise<ProcessCommand | undefined> => {
      const command = await createFormatGeneratedCommand({
        kind: this.kind,
        manager: this.manager,
        workspaceRoot: this.directory.root,
        projectRoot: this.directory.path(projectRoot),
      });

      return command
        ? { ...command, cwd: relative(this.directory.root, command.cwd) || '.' }
        : undefined;
    },
    installationRoot: async (projectRoot: string): Promise<string> =>
      relative(
        this.directory.root,
        await installationRoot({
          kind: this.kind,
          workspaceRoot: this.directory.root,
          projectRoot: this.directory.path(projectRoot),
        }),
      ) || '.',
    packageInstalled: (packageName: string): Promise<boolean> =>
      packageIsInstalled(this.directory.root, packageName),
  };
}
