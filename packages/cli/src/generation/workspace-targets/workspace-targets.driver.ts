import type {
  AtlasPackageManager,
  AtlasProjectType,
} from '../../workspace/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { ensureTurboTasks, writeNxProject } =
  await import('./workspace-targets.js');
const { readJsonFile } = await import('../../shared/index.js');

export class WorkspaceTargetsDriver {
  private readonly directory = new InMemoryDirectory();
  private packageManager: AtlasPackageManager = 'npm';

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-workspace-targets-');

      return this;
    },
    packageManager: (packageManager: AtlasPackageManager) => {
      this.packageManager = packageManager;

      return this;
    },
    turboJson: async (value: unknown) => {
      await this.directory.writeJson('turbo.json', value);

      return this;
    },
  };

  readonly when = {
    nxProjectWritten: async (
      relativeRoot: string,
      name: string,
      type: AtlasProjectType,
    ) => {
      await this.directory.mkdir(relativeRoot);
      await writeNxProject({
        workspaceRoot: this.directory.root,
        packageManager: this.packageManager,
        root: this.directory.path(relativeRoot),
        name,
        type,
      });
    },
    turboTasksEnsured: () => ensureTurboTasks(this.directory.root),
  };

  readonly get = {
    projectJson: (relativeRoot: string) =>
      readJsonFile<Record<string, unknown>>(
        this.directory.path(`${relativeRoot}/project.json`),
      ),
    turboJson: () =>
      readJsonFile<Record<string, unknown>>(this.directory.path('turbo.json')),
    outsidePath: () => `${this.directory.root}-outside`,
  };
}
