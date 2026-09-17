import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { ArtifactoryOptions } from '../artifactory-storage/artifactory-storage.js';
import {
  createPublicationStorage,
  type AtlasPublicationStorage,
  type AtlasPublicationStorageSource,
} from './publication-storage.js';
import type { S3Options } from '../s3-storage/s3-storage.js';
import { CliArguments } from '../../shared/index.js';

const STORAGE_ENVIRONMENT_KEYS = [
  'ATLAS_STORAGE',
  'ATLAS_S3_BUCKET',
  'ATLAS_STORAGE_API_URL',
  'ATLAS_STORAGE_KEY_PREFIX',
  'ATLAS_S3_REGION',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'ATLAS_S3_FORCE_PATH_STYLE',
  'ATLAS_S3_LOCK_MODE',
  'ATLAS_STORAGE_ACCESS_KEY_ID',
  'ATLAS_STORAGE_SECRET_ACCESS_KEY',
  'ATLAS_STORAGE_SESSION_TOKEN',
  'ATLAS_REGISTRY_URL',
  'ATLAS_TARGET_REGISTRY_URL',
  'ATLAS_SOURCE_REGISTRY_URL',
  'ATLAS_ARTIFACTORY_REPOSITORY',
  'ATLAS_ARTIFACTORY_ACCESS_TOKEN',
  'ATLAS_ARTIFACTORY_LOCK_RESOURCE',
  'ATLAS_PUBLICATION_LOCK',
  'ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS',
  'ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES',
];

export class PublicationStorageDriver {
  private readonly accessKeyId = faker.string.alphanumeric();
  private readonly bucket = faker.word.noun();
  private externalLeaseAcquired = false;
  private environment: NodeJS.ProcessEnv = {};
  private arguments: string[] = ['publish'];
  private configuredStorage?: AtlasPublicationStorageSource;
  private resolvedStorage?: AtlasPublicationStorage;
  private readonly nativeEnvironment = {
    ATLAS_STORAGE: 'artifactory',
    ATLAS_STORAGE_API_URL: `${faker.internet.url({ protocol: 'https', appendSlash: false })}/artifactory`,
    ATLAS_ARTIFACTORY_REPOSITORY: faker.word.noun(),
    ATLAS_ARTIFACTORY_ACCESS_TOKEN: faker.string.alphanumeric(32),
    ATLAS_REGISTRY_URL: faker.internet.url({
      protocol: 'https',
      appendSlash: false,
    }),
    ATLAS_ARTIFACTORY_LOCK_RESOURCE: faker.string.uuid(),
  };
  private readonly storage: AtlasPublicationStorage = {
    read: jest.fn<AtlasPublicationStorage['read']>(),
    readStream: jest.fn<AtlasPublicationStorage['readStream']>(),
    inspect: jest.fn<AtlasPublicationStorage['inspect']>(),
    list: jest.fn<AtlasPublicationStorage['list']>(),
    create: jest.fn<AtlasPublicationStorage['create']>(),
    replace: jest.fn<AtlasPublicationStorage['replace']>(),
    remove: jest.fn<AtlasPublicationStorage['remove']>(),
    acquireLock: jest.fn<AtlasPublicationStorage['acquireLock']>(),
  };
  private readonly factories = {
    s3: jest
      .fn<(options: S3Options) => AtlasPublicationStorage>()
      .mockReturnValue(this.storage),
    artifactory: jest
      .fn<(options: ArtifactoryOptions) => AtlasPublicationStorage>()
      .mockReturnValue(this.storage),
  };

  given = {
    environment: ({
      lockMode,
      secretAccessKey,
    }: {
      lockMode?: string;
      secretAccessKey?: 'missing';
    }): void => {
      this.environment = {
        ATLAS_S3_BUCKET: this.bucket,
        ATLAS_STORAGE: 's3',
      };
      if (lockMode) this.environment.ATLAS_S3_LOCK_MODE = lockMode;
      if (secretAccessKey === 'missing')
        this.environment.ATLAS_STORAGE_ACCESS_KEY_ID = this.accessKeyId;
    },
    nativeEnvironment: (overrides: NodeJS.ProcessEnv): void => {
      this.environment = { ...this.nativeEnvironment, ...overrides };
    },
    variables: (values: NodeJS.ProcessEnv): void => {
      this.environment = values;
    },
    arguments: (values: string[]): void => {
      this.arguments = values;
    },
    customStorage: (
      kind: 'object' | 'factory' | 'invalid' | 'invalid-delivery' | 'rejecting',
    ): void => {
      if (kind === 'object') this.configuredStorage = this.storage;
      if (kind === 'factory')
        this.configuredStorage = jest
          .fn<() => Promise<AtlasPublicationStorage>>()
          .mockResolvedValue(this.storage);
      if (kind === 'invalid')
        this.configuredStorage = {} as AtlasPublicationStorage;
      if (kind === 'invalid-delivery')
        this.configuredStorage = {
          ...this.storage,
          verifyDelivery: 'invalid',
        } as unknown as AtlasPublicationStorage;
      if (kind === 'rejecting')
        this.configuredStorage = jest
          .fn<() => Promise<AtlasPublicationStorage>>()
          .mockRejectedValue(new Error('Custom storage unavailable'));
    },
  };

  when = {
    create: async (): Promise<void> => {
      await this.withEnvironment(async () => {
        this.resolvedStorage = await createPublicationStorage(
          this.configuredStorage,
          new CliArguments(this.arguments),
          this.factories,
        );
      });
    },
    assertExternalLock: async (): Promise<void> => {
      await this.withEnvironment(async () => {
        await this.artifactoryOptions().assertExclusivePublishing();
      });
    },
    loseExternalLock: async (): Promise<void> => {
      await this.withEnvironment(async () => {
        process.env.ATLAS_PUBLICATION_LOCK =
          this.nativeEnvironment.ATLAS_ARTIFACTORY_LOCK_RESOURCE;
        await this.artifactoryOptions().assertExclusivePublishing();
        delete process.env.ATLAS_PUBLICATION_LOCK;
        await this.artifactoryOptions().assertExclusivePublishing();
      });
    },
    acquireExternalLock: async (): Promise<void> => {
      await this.withEnvironment(async () => {
        const storage = await createPublicationStorage();
        const lease = await storage.acquireLock(faker.string.uuid());
        await lease.assertHeld();
        await lease.release();
        this.externalLeaseAcquired = true;
      });
    },
  };

  get = {
    artifactoryOptions: (): ArtifactoryOptions => this.artifactoryOptions(),
    expectedArtifactoryConfiguration: () => ({
      url: this.nativeEnvironment.ATLAS_STORAGE_API_URL,
      repository: this.nativeEnvironment.ATLAS_ARTIFACTORY_REPOSITORY,
      prefix: 'atlas',
      accessToken: this.nativeEnvironment.ATLAS_ARTIFACTORY_ACCESS_TOKEN,
      publicUrl: this.nativeEnvironment.ATLAS_REGISTRY_URL,
    }),
    lockResource: (): string =>
      this.nativeEnvironment.ATLAS_ARTIFACTORY_LOCK_RESOURCE,
    s3Options: (): S3Options | undefined =>
      this.factories.s3.mock.calls.at(-1)?.[0],
    configuredStorageUsed: (): boolean =>
      this.resolvedStorage === this.storage &&
      this.factories.s3.mock.calls.length === 0 &&
      this.factories.artifactory.mock.calls.length === 0,
    externalLockIsUsable: (): boolean => this.externalLeaseAcquired,
  };

  private artifactoryOptions(): ArtifactoryOptions {
    const options = this.factories.artifactory.mock.calls.at(-1)?.[0];
    if (!options) throw new Error('Artifactory storage was not created');
    return options;
  }

  private async withEnvironment(action: () => Promise<void>): Promise<void> {
    const original = { ...process.env };
    try {
      for (const key of STORAGE_ENVIRONMENT_KEYS) delete process.env[key];
      for (const [key, value] of Object.entries(this.environment)) {
        if (value !== undefined) process.env[key] = value;
      }
      await action();
    } finally {
      for (const key of new Set([
        ...STORAGE_ENVIRONMENT_KEYS,
        ...Object.keys(this.environment),
      ])) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  }
}
