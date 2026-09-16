import { faker } from '@faker-js/faker';
import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import type { AtlasBuildResult } from '../../build/service/build.service.js';
import { sha256Digest } from '../../shared/digest/digest.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject } from '../../workspace/workspace.testkit.js';
import { anAppArtifactManifest } from '@atlas/testkit';
import { InMemoryPublicationStorage } from '../publication-storage/publication-storage.testkit.js';
import {
  publicationFiles,
  publicationIdentity,
  uploadAndVerify,
  type PublicationFile,
  type PublicationFiles,
} from './publication-files.js';

export class PublicationFilesDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly storage = new InMemoryPublicationStorage();
  private readonly files: AtlasPublishedArtifactManifest['files'] = [];
  private readonly id = faker.string.uuid();
  private readonly name = faker.commerce.productName();
  private identity: Pick<
    AtlasPublishedArtifactManifest,
    'release' | 'preview'
  > = { release: { version: faker.system.semver() } };

  readonly given = {
    sourceDirectory: async (): Promise<this> => {
      await this.directory.create('atlas-publication-files-');

      return this;
    },
    payload: async (
      path: string,
      contents: string,
      declared = contents,
    ): Promise<this> => {
      await this.directory.writeFile(path, contents);
      const bytes = new TextEncoder().encode(declared);
      this.files.push({
        path,
        digest: sha256Digest(bytes),
        size: bytes.byteLength,
        mediaType: 'text/plain',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'asset',
      });

      return this;
    },
    preview: (number: number): this => {
      this.identity = {
        preview: { number, gitSha: faker.git.commitSha() },
      };

      return this;
    },
    storedObject: (file: PublicationFile): this => {
      this.storage.seed(file.path, file.bytes, file.metadata);

      return this;
    },
  };

  readonly when = {
    uploaded: (files: readonly PublicationFile[]) =>
      uploadAndVerify({ storage: this.storage, files }),
  };

  readonly get = {
    files: (): Promise<PublicationFiles> => publicationFiles(this.build()),
    identity: (): string => publicationIdentity(this.manifest()),
    manifest: (): AtlasPublishedArtifactManifest => this.manifest(),
    storedPaths: (): string[] => [...this.storage.objects.keys()],
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
