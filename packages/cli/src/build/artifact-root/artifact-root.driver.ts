import { relative } from 'node:path';
import { faker } from '@faker-js/faker';
import type { AtlasConfig } from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject } from '../../workspace/workspace.testkit.js';
import {
  findArtifactRoot,
  findArtifactRootIfPresent,
  hashArtifactDirectory,
  listArtifactFiles,
} from './artifact-root.js';
import type { AtlasProject } from '../../workspace/index.js';

export class ArtifactRootDriver {
  private readonly directory = new TemporaryDirectory();
  private project!: AtlasProject;
  private config: AtlasConfig = {
    id: faker.string.uuid(),
    framework: 'react',
  } as AtlasConfig;
  private entryPath = 'remoteEntry.json';

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-artifact-root-');
      this.project = aProject({ root: this.directory.path('apps/orders') });

      return this;
    },
    project: (overrides: Partial<AtlasProject>): this => {
      this.project = { ...this.project, ...overrides };

      return this;
    },
    framework: (framework: AtlasConfig['framework']): this => {
      this.config = { ...this.config, framework };

      return this;
    },
    entryPath: (entryPath: string): this => {
      this.entryPath = entryPath;

      return this;
    },
    file: async (relativePath: string, contents = ''): Promise<this> => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    configId: (): string => this.config.id,
    path: (relativePath: string): string => this.directory.path(relativePath),
    artifactRootIfPresent: async (): Promise<string | undefined> => {
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
