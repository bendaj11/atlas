import type { AtlasPayloadFileDescriptor } from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  normalizeArtifactPath,
  describePayloadFiles,
  classifyPayloadRole,
} from './payload.js';

export class PayloadDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    artifactRoot: async (): Promise<this> => {
      await this.directory.create('atlas-payload-');

      return this;
    },
    file: async (relativePath: string, contents: string): Promise<this> => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    normalized: (path: string): string => normalizeArtifactPath(path),
    role: (path: string, entryPath: string) =>
      classifyPayloadRole(path, entryPath),
    descriptors: (
      paths: readonly string[],
      entryPath: string,
    ): Promise<AtlasPayloadFileDescriptor[]> =>
      describePayloadFiles({ root: this.directory.root, paths, entryPath }),
  };
}
