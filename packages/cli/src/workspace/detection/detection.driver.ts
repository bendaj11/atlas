import { relative } from 'node:path';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  detectGenerationBases,
  detectPackageManager,
  detectWorkspaceKind,
  findWorkspaceRoot,
} from './detection.js';

export class DetectionDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-detection-');

      return this;
    },
    file: async (relativePath: string, contents = ''): Promise<this> => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
    rootPackageJson: async (value: unknown): Promise<this> => {
      await this.directory.writeJson('package.json', value);

      return this;
    },
    subdirectory: async (relativePath: string): Promise<this> => {
      await this.directory.mkdir(relativePath);

      return this;
    },
  };

  readonly get = {
    rootFrom: async (relativePath: string): Promise<string> =>
      relative(
        this.directory.root,
        await findWorkspaceRoot(this.directory.path(relativePath)),
      ) || '.',
    kind: () => detectWorkspaceKind(this.directory.root),
    packageManager: () => detectPackageManager(this.directory.root),
    generationBasesFrom: (relativePath: string) =>
      detectGenerationBases({
        root: this.directory.root,
        start: this.directory.path(relativePath),
      }),
  };
}
