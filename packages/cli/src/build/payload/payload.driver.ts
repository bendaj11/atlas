import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { normalizeArtifactPath, describePayloadFiles, classifyPayloadRole } =
  await import('./payload.js');

export class PayloadDriver {
  private readonly directory = new InMemoryDirectory();

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    artifactRoot: async () => {
      await this.directory.create('atlas-payload-');

      return this;
    },
    file: async (relativePath: string, contents: string) => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    normalized: (path: string) => normalizeArtifactPath(path),
    role: (path: string, entryPath: string) =>
      classifyPayloadRole(path, entryPath),
    descriptors: (paths: readonly string[], entryPath: string) =>
      describePayloadFiles({ root: this.directory.root, paths, entryPath }),
  };
}
