import { relative } from 'node:path';
import type {
  AtlasNxProjectType,
  AtlasPackageManager,
  AtlasProject,
  AtlasTask,
  AtlasWorkspaceKind,
} from '../types.js';
import type { NxGenerationOptions } from './commands.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  createFormatGeneratedCommand,
  createInstallCommand,
  createNxGenerationCommand,
  createNxPluginInstallCommand,
  createTaskCommand,
  resolveInstallationRoot,
  isPackageInstalled,
} from './commands.js';

export class CommandsDriver {
  private readonly directory = new TemporaryDirectory();
  private kind: AtlasWorkspaceKind = 'standalone';
  private manager: AtlasPackageManager = 'npm';

  readonly given = {
    kind: (kind: AtlasWorkspaceKind) => {
      this.kind = kind;

      return this;
    },
    manager: (manager: AtlasPackageManager) => {
      this.manager = manager;

      return this;
    },
    workspace: async () => {
      await this.directory.create('atlas-commands-');

      return this;
    },
    workspaceFile: async (relativePath: string, value: unknown) => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
  };

  readonly get = {
    taskCommand: (project: AtlasProject, task: AtlasTask, args?: string[]) =>
      createTaskCommand({
        kind: this.kind,
        manager: this.manager,
        root: '/repo',
        project,
        task,
        args,
      }),
    nxGenerationCommand: (generation: NxGenerationOptions) =>
      createNxGenerationCommand({
        manager: this.manager,
        root: '/repo',
        generation,
      }),
    nxPluginInstallCommand: (projectType: AtlasNxProjectType) =>
      createNxPluginInstallCommand({
        manager: this.manager,
        root: '/repo',
        projectType,
      }),
    installCommand: (projectRoot: string) =>
      createInstallCommand({ manager: this.manager, projectRoot }),
    formatCommand: async (projectRoot: string) => {
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
    installationRoot: async (projectRoot: string) =>
      relative(
        this.directory.root,
        await resolveInstallationRoot({
          kind: this.kind,
          workspaceRoot: this.directory.root,
          projectRoot: this.directory.path(projectRoot),
        }),
      ) || '.',
    packageInstalled: (packageName: string) =>
      isPackageInstalled(this.directory.root, packageName),
  };
}
