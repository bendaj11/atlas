import { relative } from 'node:path';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const {
  detectGenerationBases,
  detectPackageManager,
  detectWorkspaceKind,
  findWorkspaceRoot,
} = await import('./detection.js');

export class DetectionDriver {
  private readonly directory = new InMemoryDirectory();

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-detection-');

      return this;
    },
    file: async (relativePath: string, contents = '') => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
    rootPackageJson: async (value: unknown) => {
      await this.directory.writeJson('package.json', value);

      return this;
    },
    subdirectory: async (relativePath: string) => {
      await this.directory.mkdir(relativePath);

      return this;
    },
  };

  readonly get = {
    rootFrom: async (relativePath: string) =>
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
