import { faker } from '@faker-js/faker';
import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import { anAppArtifactManifest } from '@atlas/testkit';
import type { PublicationFile } from './publication-files.js';
import type { AtlasBuildResult } from '../../build/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { aProject } = await import('../../workspace/workspace.testkit.js');
const { InMemoryPublicationStorage } =
  await import('../publication-storage/publication-storage.testkit.js');
const { preparePublicationFiles, derivePublicationIdentity, uploadAndVerify } =
  await import('./publication-files.js');
const { computeSha256Digest } = await import('../../shared/index.js');

export class PublicationFilesDriver {
  private readonly directory = new InMemoryDirectory();
  private readonly storage = new InMemoryPublicationStorage();
  private readonly files: AtlasPublishedArtifactManifest['files'] = [];
  private readonly id = faker.string.uuid();
  private readonly name = faker.commerce.productName();
  private identity: Pick<
    AtlasPublishedArtifactManifest,
    'release' | 'preview'
  > = { release: { version: faker.system.semver() } };

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    sourceDirectory: async () => {
      await this.directory.create('atlas-publication-files-');

      return this;
    },
    payload: async (path: string, contents: string, declared = contents) => {
      await this.directory.writeFile(path, contents);
      const bytes = new TextEncoder().encode(declared);
      this.files.push({
        path,
        digest: computeSha256Digest(bytes),
        size: bytes.byteLength,
        mediaType: 'text/plain',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'asset',
      });

      return this;
    },
    preview: (number: number) => {
      this.identity = {
        preview: { number, gitSha: faker.git.commitSha() },
      };

      return this;
    },
    storedObject: (file: PublicationFile) => {
      this.storage.seed(file.path, file.bytes, file.metadata);

      return this;
    },
  };

  readonly when = {
    uploaded: (files: readonly PublicationFile[]) =>
      uploadAndVerify({ storage: this.storage, files }),
  };

  readonly get = {
    files: () => preparePublicationFiles(this.build()),
    identity: () => derivePublicationIdentity(this.manifest()),
    manifest: () => this.manifest(),
    storedPaths: () => [...this.storage.objects.keys()],
  };

  private build(): AtlasBuildResult {
    const manifest = this.manifest();

    return {
      artifact: 'app',
      manifest,
      project: aProject(),
      sourceDirectory: this.directory.root,
      files: manifest.files.map(({ path }) => path),
    };
  }

  private manifest(): AtlasPublishedArtifactManifest {
    return anAppArtifactManifest({
      id: this.id,
      name: this.name,
      files: this.files,
      ...(this.identity.preview
        ? { release: undefined, preview: this.identity.preview }
        : { release: this.identity.release }),
    });
  }
}
