import { artifactoryOptionsFromEnvironment } from '../artifactory-options/artifactory-options.js';
import {
  ArtifactoryPublicationStorage,
  type ArtifactoryOptions,
} from '../artifactory-storage/artifactory-storage.js';
import {
  S3PublicationStorage,
  type S3Options,
} from '../s3-storage/s3-storage.js';
import { selectStorageFromEnvironment } from '../storage-environment/storage-environment.js';
import { type CliArguments, cliError } from '../../shared/index.js';

export interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  readStream(path: string): Promise<AsyncIterable<Uint8Array> | undefined>;
  inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined>;
  verifyDelivery?(paths: readonly string[]): Promise<void>;
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

const DEFAULT_FACTORIES: PublicationStorageFactories = {
  s3: (options) => new S3PublicationStorage(options),
  artifactory: (options) => new ArtifactoryPublicationStorage(options),
};

export async function createPublicationStorage(
  storage?: AtlasPublicationStorageSource,
  args?: CliArguments,
  factories: PublicationStorageFactories = DEFAULT_FACTORIES,
): Promise<AtlasPublicationStorage> {
  const configured = storage ?? storageFromEnvironment(args, factories);
  if (!configured) {
    throw cliError(
      'Publication storage is not configured.',
      [
        'Pass --storage s3 with --bucket (or set ATLAS_S3_BUCKET).',
        'Pass --storage artifactory (or set ATLAS_STORAGE=artifactory).',
        'Configure storage in atlas.registry.ts.',
      ],
      { code: 'ATLAS_STORAGE_NOT_CONFIGURED' },
    );
  }
  const resolvedStorage =
    typeof configured === 'function' ? await configured() : configured;
  if (!isPublicationStorage(resolvedStorage))
    throw new Error(
      'Publication storage must implement AtlasPublicationStorage.',
    );

  return resolvedStorage;
}

export function isPublicationStorage(
  value: unknown,
): value is AtlasPublicationStorage {
  if (typeof value !== 'object' || value === null) return false;
  const storage = value as Partial<AtlasPublicationStorage>;

  return (
    typeof storage.read === 'function' &&
    typeof storage.readStream === 'function' &&
    typeof storage.inspect === 'function' &&
    (storage.verifyDelivery === undefined ||
      typeof storage.verifyDelivery === 'function') &&
    typeof storage.list === 'function' &&
    typeof storage.create === 'function' &&
    typeof storage.replace === 'function' &&
    typeof storage.remove === 'function' &&
    typeof storage.acquireLock === 'function'
  );
}

function storageFromEnvironment(
  args: CliArguments | undefined,
  factories: PublicationStorageFactories,
): AtlasPublicationStorage | undefined {
  const selection = selectStorageFromEnvironment(args);
  if (!selection) return undefined;
  if (selection.provider === 'artifactory')
    return factories.artifactory(artifactoryOptionsFromEnvironment(args));

  return factories.s3(selection.s3Options);
}
