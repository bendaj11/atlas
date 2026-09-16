import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import type {
  AtlasPackageManager,
  AtlasProjectType,
} from '../../workspace/types.js';
import { readJsonFile } from '../../shared/fs/fs.js';
import { ensureTurboTasks, writeNxProject } from './workspace-targets.js';

export class WorkspaceTargetsDriver {
  private readonly directory = new TemporaryDirectory();
  private packageManager: AtlasPackageManager = 'npm';

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-workspace-targets-');

      return this;
    },
    packageManager: (packageManager: AtlasPackageManager): this => {
      this.packageManager = packageManager;

      return this;
    },
    turboJson: async (value: unknown): Promise<this> => {
      await this.directory.writeJson('turbo.json', value);

      return this;
    },
  };

  readonly when = {
    nxProjectWritten: async (
      relativeRoot: string,
      name: string,
      type: AtlasProjectType,
    ): Promise<void> => {
      await this.directory.mkdir(relativeRoot);
      await writeNxProject({
        workspaceRoot: this.directory.root,
        packageManager: this.packageManager,
        root: this.directory.path(relativeRoot),
        name,
        type,
      });
    },
    turboTasksEnsured: (): Promise<void> =>
      ensureTurboTasks(this.directory.root),
  };

  readonly get = {
    projectJson: (relativeRoot: string) =>
      readJsonFile<Record<string, unknown>>(
        this.directory.path(`${relativeRoot}/project.json`),
      ),
    turboJson: () =>
      readJsonFile<Record<string, unknown>>(this.directory.path('turbo.json')),
    outsidePath: (): string => `${this.directory.root}-outside`,
  };
}
