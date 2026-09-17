import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { ArtifactoryClient } from '../artifactory-client/artifactory-client.js';
import type {
  AtlasPublicationLease,
  AtlasPublicationReplaceCondition,
} from '../publication-storage/types.js';
import {
  ArtifactoryPublicationStorage,
  type ArtifactoryOptions,
} from './artifactory-storage.js';

export class ArtifactoryStorageDriver {
  private readonly fixture = {
    path: `apps/${faker.string.uuid()}/1.0.0/manifest.json`,
    bytes: Buffer.from('hello'),
    checksum:
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    accessToken: faker.string.alphanumeric(32),
  };
  private readonly metadata = {
    contentType: 'application/json',
    cacheControl: 'public, max-age=31536000, immutable',
  };
  private readonly guard = jest
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined);
  private readonly client = {
    readStream: jest
      .fn<ArtifactoryClient['readStream']>()
      .mockResolvedValue(undefined),
    readPublicStream: jest
      .fn<ArtifactoryClient['readPublicStream']>()
      .mockImplementation(async () => this.chunks(this.fixture.bytes)),
    fileInfo: jest
      .fn<ArtifactoryClient['fileInfo']>()
      .mockResolvedValue(undefined),
    metadata: jest
      .fn<ArtifactoryClient['metadata']>()
      .mockResolvedValue(this.metadata),
    deliveryMetadata: jest
      .fn<ArtifactoryClient['deliveryMetadata']>()
      .mockResolvedValue(this.metadata),
    list: jest.fn<ArtifactoryClient['list']>().mockResolvedValue([]),
    upload: jest.fn<ArtifactoryClient['upload']>().mockResolvedValue(undefined),
    remove: jest.fn<ArtifactoryClient['remove']>().mockResolvedValue(undefined),
  };
  private maximumBytes = 100;
  private instance?: ArtifactoryPublicationStorage;
  private lease?: AtlasPublicationLease;

  constructor() {
    this.client.upload.mockImplementation(
      async ({ bytes, sha256, contentType, cacheControl }) => {
        this.client.fileInfo.mockResolvedValue({
          size: bytes.byteLength,
          versionToken: sha256,
        });
        this.client.metadata.mockResolvedValue({ contentType, cacheControl });
      },
    );
  }

  readonly given = {
    object: (state: 'present' | 'absent') => {
      this.client.fileInfo.mockResolvedValue(
        state === 'present'
          ? {
              size: this.fixture.bytes.length,
              versionToken: this.fixture.checksum,
            }
          : undefined,
      );
    },
    maximumBytes: (bytes: number) => {
      this.maximumBytes = bytes;
    },
    download: (body: string) => {
      this.client.readStream.mockResolvedValue(this.chunks(Buffer.from(body)));
    },
    publicBody: (body: string | undefined) => {
      this.client.readPublicStream.mockImplementation(async () =>
        body === undefined ? undefined : this.chunks(Buffer.from(body)),
      );
    },
    deliveryHeaders: (headers: Partial<typeof this.metadata>) => {
      this.client.deliveryMetadata.mockResolvedValue({
        ...this.metadata,
        ...headers,
      });
    },
    failure: (
      operation:
        | 'readStream'
        | 'readPublicStream'
        | 'fileInfo'
        | 'metadata'
        | 'deliveryMetadata'
        | 'list'
        | 'upload'
        | 'remove',
    ) => {
      this.client[operation].mockRejectedValue(
        new Error('Storage unavailable.'),
      );
    },
    mutationFailure: (failure: {
      operation: 'upload' | 'remove';
      outcome: 'unknown' | 'rejected';
    }) => {
      this.client[failure.operation].mockRejectedValueOnce(
        Object.assign(new Error('Artifactory mutation failed.'), {
          publicationOutcomeUnknown: failure.outcome === 'unknown',
        }),
      );
    },
    lostLock: (afterAssertions: number) => {
      for (let index = 0; index < afterAssertions; index++)
        this.guard.mockResolvedValueOnce(undefined);
      this.guard.mockRejectedValue(
        new Error('External publishing lock is not held.'),
      );
    },
    files: (count: number) => {
      this.client.list.mockResolvedValue(
        Array.from({ length: count }, (_, index) => ({
          path: `apps/example/previews/${index}.json`,
          size: this.fixture.bytes.length,
        })),
      );
    },
  };

  readonly when = {
    construct: (overrides: Partial<ArtifactoryOptions> = {}) =>
      new ArtifactoryPublicationStorage(
        { ...this.options(), ...overrides },
        this.client,
      ),
    read: () => this.storage().read(this.fixture.path),
    readStream: () => this.storage().readStream(this.fixture.path),
    inspect: () => this.storage().inspect(this.fixture.path),
    verifyDelivery: () => this.storage().verifyDelivery([this.fixture.path]),
    publishAndVerify: async () => {
      await this.when.create();
      await this.when.verifyDelivery();
    },
    list: () => this.storage().list('apps/example/previews/'),
    create: () =>
      this.storage().create(
        this.fixture.path,
        this.fixture.bytes,
        this.metadata,
      ),
    createStream: () =>
      this.storage().create(
        this.fixture.path,
        this.chunks(this.fixture.bytes),
        this.metadata,
      ),
    createBrokenStream: () =>
      this.storage().create(
        this.fixture.path,
        this.brokenChunks(),
        this.metadata,
      ),
    createDeclaredSize: (size: number) =>
      this.storage().create(this.fixture.path, this.fixture.bytes, {
        ...this.metadata,
        size,
      }),
    replace: (condition?: AtlasPublicationReplaceCondition) =>
      this.storage().replace(
        this.fixture.path,
        this.fixture.bytes,
        this.metadata,
        condition ?? { versionToken: this.fixture.checksum },
      ),
    replaceMutable: () =>
      this.storage().replace(
        'environments/test/deployment.json',
        this.fixture.bytes,
        {
          contentType: 'application/json',
          cacheControl: 'no-cache, max-age=0, must-revalidate',
        },
        { createOnly: true },
      ),
    replaceMutableAndVerify: async () => {
      await this.when.replaceMutable();
      await this.storage().verifyDelivery([
        'environments/test/deployment.json',
      ]);
    },
    remove: () => this.storage().remove(this.fixture.path),
    acquire: async () => {
      this.lease = await this.storage().acquireLock(faker.string.uuid());
    },
    assertHeld: () => this.acquiredLease().assertHeld(),
    release: () => this.acquiredLease().release(),
    createConcurrently: () =>
      Promise.allSettled([
        this.storage().create(
          this.fixture.path,
          this.fixture.bytes,
          this.metadata,
        ),
        this.storage().create(
          this.fixture.path,
          this.fixture.bytes,
          this.metadata,
        ),
      ]),
    replaceConcurrently: () =>
      Promise.allSettled([
        this.when.replace({ createOnly: true }),
        this.when.replace({ createOnly: true }),
      ]),
  };

  readonly get = {
    bytes: () => this.fixture.bytes,
    metadata: () => ({
      ...this.metadata,
      size: this.fixture.bytes.length,
      versionToken: this.fixture.checksum,
    }),
    uploads: () => this.client.upload.mock.calls.map(([input]) => input),
    expectedUpload: () => ({
      path: this.fixture.path,
      bytes: this.fixture.bytes,
      contentType: this.metadata.contentType,
      cacheControl: this.metadata.cacheControl,
      sha256: this.fixture.checksum,
    }),
    removed: () => this.client.remove.mock.calls.map(([path]) => path),
    path: () => this.fixture.path,
    checkedDelivery: () =>
      this.client.deliveryMetadata.mock.calls.map(([path]) => path),
    authoritativeRequests: () => this.client.fileInfo.mock.calls.length,
  };

  private options(): ArtifactoryOptions {
    return {
      url: 'https://artifactory.example.invalid/artifactory',
      repository: 'atlas-local',
      prefix: 'atlas',
      publicUrl: 'https://assets.example.invalid/atlas',
      accessToken: this.fixture.accessToken,
      assertExclusivePublishing: this.guard,
      maxBufferedBytes: this.maximumBytes,
    };
  }

  private storage(): ArtifactoryPublicationStorage {
    this.instance ??= new ArtifactoryPublicationStorage(
      this.options(),
      this.client,
    );
    return this.instance;
  }

  private acquiredLease(): AtlasPublicationLease {
    if (!this.lease) throw new Error('Acquire a lease first.');
    return this.lease;
  }

  private async *chunks(bytes: Uint8Array): AsyncIterable<Uint8Array> {
    yield bytes.subarray(0, 1);
    yield bytes.subarray(1);
  }

  private async *brokenChunks(): AsyncIterable<Uint8Array> {
    yield this.fixture.bytes;
    throw new Error('Build artifact stream failed.');
  }
}
