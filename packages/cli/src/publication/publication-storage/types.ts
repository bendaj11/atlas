import type { ArtifactoryOptions } from '../artifactory-storage/artifactory-storage.js';
import type { S3Options } from '../s3-storage/s3-storage.js';

export interface AtlasPublicationDeliveryOptions {
  readonly concurrency?: number;
}

export interface AtlasPublicationStorage {
  readonly verifiesCreatedObjects?: boolean;
  read(path: string): Promise<Uint8Array | undefined>;
  readStream(path: string): Promise<AsyncIterable<Uint8Array> | undefined>;
  inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined>;
  verifyDelivery?(
    paths: readonly string[],
    options?: AtlasPublicationDeliveryOptions,
  ): Promise<void>;
  list(prefix: string): Promise<AtlasPublicationListedObject[]>;
  create(
    path: string,
    bytes: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void>;
  replace(
    path: string,
    bytes: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
    condition: AtlasPublicationReplaceCondition,
  ): Promise<void>;
  remove(path: string): Promise<void>;
  acquireLock(owner: string): Promise<AtlasPublicationLease>;
}

export interface AtlasPublicationLease {
  assertHeld(): Promise<void>;
  release(): Promise<void>;
}

export interface AtlasPublicationObjectMetadata {
  readonly cacheControl: string;
  readonly contentType: string;
  readonly size?: number;
  readonly versionToken?: string;
  readonly lastModified?: string;
}

export type AtlasPublicationBody = Uint8Array | AsyncIterable<Uint8Array>;

export interface AtlasPublicationReplaceCondition {
  readonly versionToken?: string;
  readonly createOnly?: boolean;
}

export interface AtlasPublicationListedObject {
  readonly path: string;
  readonly size: number;
  readonly lastModified?: string;
}

export type AtlasPublicationStorageSource =
  | AtlasPublicationStorage
  | (() => AtlasPublicationStorage | Promise<AtlasPublicationStorage>);

export interface PublicationStorageFactories {
  readonly s3: (options: S3Options) => AtlasPublicationStorage;
  readonly artifactory: (
    options: ArtifactoryOptions,
  ) => AtlasPublicationStorage;
}
