import type { ChildProcess } from 'node:child_process';
import { relative } from 'node:path';
import { jest } from '@jest/globals';
import type * as ProcessModule from '../../shared/process/process.js';
import type {
  AtlasScaffoldOptions,
  AtlasTask,
  AtlasWorkspace,
} from '../types.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';

const processModule = await import('../../shared/process/process.js');
const runProcess = jest.fn<typeof ProcessModule.runProcess>();
const spawnProcess = jest.fn<typeof ProcessModule.spawnProcess>();
jest.unstable_mockModule('../../shared/process/process.js', () => ({
  ...processModule,
  runProcess,
  spawnProcess,
}));

const { detectWorkspace } = await import('./workspace.js');

export class WorkspaceDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly child = {} as ChildProcess;
  private workspace!: AtlasWorkspace;

  constructor() {
    runProcess.mockReset();
    spawnProcess.mockReset();
    runProcess.mockResolvedValue(undefined);
    spawnProcess.mockReturnValue(this.child);
  }

  readonly given = {
    directory: async () => {
      await this.directory.create('atlas-workspace-');

      return this;
    },
    file: async (relativePath: string, value: unknown) => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
    sourceFile: async (relativePath: string, contents: string) => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
    processFailure: (error: Error) => {
      runProcess.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    detected: async (start = '.') => {
      this.workspace = await detectWorkspace(this.directory.path(start));
    },
    taskRun: async (projectName: string, task: AtlasTask, args: string[]) => {
      const project = await this.workspace.findProject(projectName);
      await this.workspace.run(project, task, args);
    },
    taskSpawned: async (
      projectName: string,
      task: AtlasTask,
      args: string[],
    ) => {
      const project = await this.workspace.findProject(projectName);
      this.workspace.spawn(project, task, args);
    },
    dependenciesInstalled: (projectRoot: string) =>
      this.workspace.installDependencies(this.directory.path(projectRoot)),
    scaffoldDependencyInstalled: (type: 'angular' | 'react') =>
      this.workspace.installScaffoldDependency(type),
  };

  readonly get = {
    kind: () => this.workspace.kind,
    packageManager: () => this.workspace.packageManager,
    root: () => relative(this.directory.root, this.workspace.root) || '.',
    absoluteRoot: () => this.workspace.root,
    path: (relativePath: string) => this.directory.path(relativePath),
    generationRoot: (type: 'host' | 'app', name: string) =>
      relative(this.directory.root, this.workspace.generationRoot(type, name)),
    missingScaffoldDependency: (type: 'angular' | 'react') =>
      this.workspace.missingScaffoldDependency(type),
    formatGenerated: (projectRoot: string) =>
      this.workspace.formatGenerated(this.directory.path(projectRoot)),
    scaffoldProject: (options: AtlasScaffoldOptions) =>
      this.workspace.scaffoldProject(options),
    runProcessMock: () => runProcess,
    spawnProcessMock: () => spawnProcess,
    spawnedChild: () => this.child,
  };
}
