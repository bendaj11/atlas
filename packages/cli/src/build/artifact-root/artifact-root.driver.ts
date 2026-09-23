import { relative } from 'node:path';
import { faker } from '@faker-js/faker';
import type { AtlasConfig } from '@atlas/schema';
import type { AtlasProject } from '../../workspace/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { aProject } = await import('../../workspace/workspace.testkit.js');
const {
  findArtifactRoot,
  findArtifactRootIfPresent,
  hashArtifactDirectory,
  listArtifactFiles,
} = await import('./artifact-root.js');

export class ArtifactRootDriver {
  private readonly directory = new InMemoryDirectory();
  private project!: AtlasProject;
  private config: AtlasConfig = {
    id: faker.string.uuid(),
    framework: 'react',
  } as AtlasConfig;
  private entryPath = 'remoteEntry.json';

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-artifact-root-');
      this.project = aProject({ root: this.directory.path('apps/orders') });

      return this;
    },
    project: (overrides: Partial<AtlasProject>) => {
      this.project = { ...this.project, ...overrides };

      return this;
    },
    framework: (framework: AtlasConfig['framework']) => {
      this.config = { ...this.config, framework };

      return this;
    },
    entryPath: (entryPath: string) => {
      this.entryPath = entryPath;

      return this;
    },
    file: async (relativePath: string, contents = '') => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    configId: () => this.config.id,
    path: (relativePath: string) => this.directory.path(relativePath),
    artifactRootIfPresent: async () => {
      const root = await findArtifactRootIfPresent(this.lookup());

      return root ? relative(this.directory.root, root) : undefined;
    },
    artifactRoot: () => findArtifactRoot(this.lookup()),
    files: (relativeRoot: string) =>
      listArtifactFiles(this.directory.path(relativeRoot)),
    hash: (relativeRoot: string) =>
      hashArtifactDirectory(this.directory.path(relativeRoot)),
  };

  private lookup() {
    return {
      workspaceRoot: this.directory.root,
      project: this.project,
      config: this.config,
      entryPath: this.entryPath,
    };
  }
}
