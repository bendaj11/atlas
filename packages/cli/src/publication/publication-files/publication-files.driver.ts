import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import { anAppArtifactManifest } from '@atlas/testkit/internal';
import type { PublicationFile, PublicationFiles } from './publication-files.js';
import type { AtlasBuildResult } from '../../build/index.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject } from '../../workspace/workspace.testkit.js';
import { InMemoryPublicationStorage } from '../publication-storage/publication-storage.testkit.js';
import {
  preparePublicationFiles,
  derivePublicationIdentity,
  uploadAndVerify,
} from './publication-files.js';
import { computeSha256Digest } from '../../shared/index.js';

export class PublicationFilesDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly storage = new InMemoryPublicationStorage();
  private readonly create = jest.spyOn(this.storage, 'create');
  private readonly read = jest.spyOn(this.storage, 'read');
  private readonly progress: string[] = [];
  private readonly files: AtlasPublishedArtifactManifest['files'] = [];
  private readonly id = faker.string.uuid();
  private readonly name = faker.commerce.productName();
  private identity: Pick<
    AtlasPublishedArtifactManifest,
    'release' | 'preview'
  > = { release: { version: faker.system.semver() } };

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
    storageVerifyingCreatedObjects: () => {
      Object.assign(this.storage, { verifiesCreatedObjects: true });

      return this;
    },
  };

  readonly when = {
    uploaded: (files: PublicationFiles) =>
      uploadAndVerify({
        storage: this.storage,
        files,
        concurrency: 2,
        progress: {
          start: (message) => this.progress.push(message),
          update: (message) => this.progress.push(message),
          succeed: (message) => this.progress.push(message),
          fail: (message) => this.progress.push(message),
          warn: (message) => this.progress.push(message),
        },
      }),
  };

  readonly get = {
    files: () => preparePublicationFiles(this.build()),
    identity: () => derivePublicationIdentity(this.manifest()),
    manifest: () => this.manifest(),
    storedPaths: () => [...this.storage.objects.keys()],
    createdPaths: () => this.create.mock.calls.map(([path]) => path),
    readPaths: () => this.read.mock.calls.map(([path]) => path),
    progress: () => this.progress,
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
