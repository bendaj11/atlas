import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { publicationContentType } from '../publication-metadata/publication-metadata.js';
import type { CliArguments } from '../../cli/arguments.js';

export interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  readStream(path: string): Promise<AsyncIterable<Uint8Array> | undefined>;
  inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined>;
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

export async function createPublicationStorage(
  storage?: AtlasPublicationStorageSource,
  args?: CliArguments,
): Promise<AtlasPublicationStorage> {
  const configured = storage ?? storageFromEnvironment(args);
  if (!configured) {
    throw new Error(
      'Publication storage is required. Pass --bucket (or ATLAS_S3_BUCKET), or configure storage in atlas.registry.ts.',
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

export interface S3Options {
  bucket: string;
  endpoint?: string;
  prefix?: string;
  region?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  lockMode?: S3PublicationLockMode;
  lockTimeoutMs?: number;
  lockLeaseMs?: number;
}

export type S3PublicationLockMode = 'external' | 's3';

interface DeploymentLease {
  readonly owner: string;
  readonly token: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

interface StoredLease {
  readonly lease: DeploymentLease;
  readonly etag: string;
}

const DEPLOYMENT_LOCK_PATH = '.atlas/deployment.lock';
const DEFAULT_LOCK_TIMEOUT_MS = 120_000;
const DEFAULT_LOCK_LEASE_MS = 30_000;
const MINIMUM_LOCK_LEASE_MS = 3_000;

export class S3PublicationStorage implements AtlasPublicationStorage {
  private readonly client: Pick<S3Client, 'send'>;
  private readonly prefix: string;
  private readonly lockTimeoutMs: number;
  private readonly lockLeaseMs: number;

  constructor(
    private readonly options: S3Options,
    client?: Pick<S3Client, 'send'>,
  ) {
    if (!options.bucket)
      throw new Error('S3 publication storage requires a bucket.');
    this.prefix = options.prefix?.replace(/^\/+|\/+$/g, '') ?? '';
    this.lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.lockLeaseMs = options.lockLeaseMs ?? DEFAULT_LOCK_LEASE_MS;
    if (this.lockTimeoutMs < 0)
      throw new Error('S3 lock timeout must not be negative.');
    if (this.lockLeaseMs < MINIMUM_LOCK_LEASE_MS) {
      throw new Error(
        `S3 lock lease must be at least ${MINIMUM_LOCK_LEASE_MS}ms.`,
      );
    }
    this.client = client ?? new S3Client(s3ClientConfig(options));
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand(this.objectInput(path)),
      );
      return response.Body
        ? await response.Body.transformToByteArray()
        : new Uint8Array();
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError(`read ${path}`, error);
    }
  }

  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand(this.objectInput(path)),
      );
      return response.Body as AsyncIterable<Uint8Array> | undefined;
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError(`stream ${path}`, error);
    }
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand(this.objectInput(path)),
      );
      if (!response.CacheControl || !response.ContentType) {
        throw new Error(
          `Published object ${path} is missing Cache-Control or Content-Type metadata.`,
        );
      }
      return {
        cacheControl: response.CacheControl,
        contentType: response.ContentType,
        ...(response.ContentLength !== undefined
          ? { size: response.ContentLength }
          : {}),
        ...(response.ETag ? { versionToken: response.ETag } : {}),
        ...(response.LastModified
          ? { lastModified: response.LastModified.toISOString() }
          : {}),
      };
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError(`inspect ${path}`, error);
    }
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    const objects: AtlasPublicationListedObject[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: this.objectKey(prefix),
          ...(continuationToken
            ? { ContinuationToken: continuationToken }
            : {}),
        }),
      );
      for (const object of response.Contents ?? []) {
        if (!object.Key || object.Size === undefined) continue;
        objects.push({
          path: this.pathFromObjectKey(object.Key),
          size: object.Size,
          ...(object.LastModified
            ? { lastModified: object.LastModified.toISOString() }
            : {}),
        });
      }
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return objects;
  }

  async create(
    path: string,
    bytes: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          ...this.objectInput(path),
          Body: requestBody(bytes),
          CacheControl: metadata.cacheControl,
          ContentType: metadata.contentType,
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (isPreconditionFailure(error))
        throw new Error(
          `Immutable publication object already exists: ${path}`,
          { cause: error },
        );
      throw storageError(`create ${path}`, error);
    }
  }

  async replace(
    path: string,
    bytes: AtlasPublicationBody,
    metadata: AtlasPublicationObjectMetadata,
    condition: AtlasPublicationReplaceCondition,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          ...this.objectInput(path),
          Body: requestBody(bytes),
          CacheControl: metadata.cacheControl,
          ContentType: metadata.contentType,
          ...(condition.createOnly ? { IfNoneMatch: '*' } : {}),
          ...(condition.versionToken
            ? { IfMatch: condition.versionToken }
            : {}),
        }),
      );
    } catch (error) {
      if (isPreconditionFailure(error)) {
        throw new Error(`Conditional publication write conflicted: ${path}`, {
          cause: error,
        });
      }
      throw storageError(`replace ${path}`, error);
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand(this.objectInput(path)));
    } catch (error) {
      if (!isMissingObject(error)) throw storageError(`remove ${path}`, error);
    }
  }

  async acquireLock(owner: string): Promise<AtlasPublicationLease> {
    if (this.options.lockMode === 'external') return externalPublicationLease();

    return await this.acquireS3Lock(owner);
  }

  private async acquireS3Lock(owner: string): Promise<AtlasPublicationLease> {
    const deadline = Date.now() + this.lockTimeoutMs;
    const token = randomUUID();
    let stored = await this.tryAcquireLease(owner, token);
    while (!stored) {
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out after ${this.lockTimeoutMs}ms waiting for Atlas deployment lock.`,
        );
      }
      await wait(randomBackoffMs());
      stored = await this.tryAcquireLease(owner, token);
    }

    let active = true;
    let leaseError: unknown;
    let currentEtag = stored.etag;
    let renewalPromise = Promise.resolve();
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRenewal = (): void => {
      renewalTimer = setTimeout(
        () => {
          renewalPromise = this.renewLease(owner, token, currentEtag)
            .then((etag) => {
              currentEtag = etag;
              if (active) scheduleRenewal();
            })
            .catch((error: unknown) => {
              leaseError = error;
              active = false;
            });
        },
        Math.floor(this.lockLeaseMs / 3),
      );
      renewalTimer.unref();
    };
    scheduleRenewal();

    return {
      assertHeld: async () => {
        if (leaseError)
          throw new Error(
            'Atlas deployment lease renewal failed; publication stopped before further mutation.',
            { cause: leaseError },
          );
        const current = await this.readLease();
        if (
          !current ||
          current.lease.token !== token ||
          Date.parse(current.lease.expiresAt) <= Date.now()
        ) {
          active = false;
          throw new Error(
            'Atlas deployment lease is no longer owned by this publisher.',
          );
        }
      },
      release: async () => {
        if (renewalTimer) clearTimeout(renewalTimer);
        active = false;
        await renewalPromise;
        if (leaseError)
          throw new Error(
            'Atlas deployment lease was lost during publication.',
            { cause: leaseError },
          );
        await this.releaseLease(token);
      },
    };
  }

  private async tryAcquireLease(
    owner: string,
    token: string,
  ): Promise<StoredLease | undefined> {
    const lease = this.newLease(owner, token);
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          ...this.objectInput(DEPLOYMENT_LOCK_PATH),
          Body: encodeLease(lease),
          CacheControl: 'no-store',
          ContentType: publicationContentType('lock.json'),
          IfNoneMatch: '*',
        }),
      );
      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (!isPreconditionFailure(error))
        throw storageError('acquire deployment lock', error);
    }

    const existing = await this.readLease();
    if (!existing || Date.parse(existing.lease.expiresAt) > Date.now())
      return undefined;
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          ...this.objectInput(DEPLOYMENT_LOCK_PATH),
          Body: encodeLease(lease),
          CacheControl: 'no-store',
          ContentType: publicationContentType('lock.json'),
          IfMatch: existing.etag,
        }),
      );
      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (isPreconditionFailure(error)) return undefined;
      throw storageError('recover expired deployment lock', error);
    }
  }

  private async renewLease(
    owner: string,
    token: string,
    etag: string,
  ): Promise<string> {
    const response = await this.client.send(
      new PutObjectCommand({
        ...this.objectInput(DEPLOYMENT_LOCK_PATH),
        Body: encodeLease(this.newLease(owner, token)),
        CacheControl: 'no-store',
        ContentType: publicationContentType('lock.json'),
        IfMatch: etag,
      }),
    );
    return requiredEtag(response.ETag);
  }

  private async releaseLease(token: string): Promise<void> {
    const current = await this.readLease();
    if (!current || current.lease.token !== token) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({
          ...this.objectInput(DEPLOYMENT_LOCK_PATH),
          IfMatch: current.etag,
        }),
      );
    } catch (error) {
      if (!isMissingObject(error) && !isPreconditionFailure(error))
        throw storageError('release deployment lock', error);
    }
  }

  private async readLease(): Promise<StoredLease | undefined> {
    try {
      const response = await this.client.send(
        new GetObjectCommand(this.objectInput(DEPLOYMENT_LOCK_PATH)),
      );
      if (!response.Body || !response.ETag) return undefined;
      const value = JSON.parse(
        await response.Body.transformToString(),
      ) as unknown;
      return { lease: assertLease(value), etag: response.ETag };
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError('read deployment lock', error);
    }
  }

  private newLease(owner: string, token: string): DeploymentLease {
    const now = new Date();
    return {
      owner,
      token,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.valueOf() + this.lockLeaseMs).toISOString(),
    };
  }

  private objectInput(path: string): { Bucket: string; Key: string } {
    return {
      Bucket: this.options.bucket,
      Key: [this.prefix, path].filter(Boolean).join('/'),
    };
  }

  private objectKey(path: string): string {
    return [this.prefix, path].filter(Boolean).join('/');
  }

  private pathFromObjectKey(key: string): string {
    return this.prefix && key.startsWith(`${this.prefix}/`)
      ? key.slice(this.prefix.length + 1)
      : key;
  }
}

function requestBody(body: AtlasPublicationBody): Uint8Array | Readable {
  return body instanceof Uint8Array ? body : Readable.from(body);
}

function storageFromEnvironment(
  args?: CliArguments,
): AtlasPublicationStorage | undefined {
  const provider = process.env.ATLAS_STORAGE;
  const bucket = args?.flag('bucket') ?? process.env.ATLAS_S3_BUCKET;
  if (!provider && !bucket) return undefined;
  if (provider && provider !== 's3')
    throw new Error(`Unsupported ATLAS_STORAGE provider "${provider}".`);
  if (!bucket)
    throw new Error('ATLAS_S3_BUCKET is required when ATLAS_STORAGE=s3.');
  const accessKeyId = process.env.ATLAS_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      'ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together.',
    );
  }
  return new S3PublicationStorage({
    bucket,
    ...((args?.flag('storage-api-url') ?? process.env.ATLAS_STORAGE_API_URL)
      ? {
          endpoint:
            args?.flag('storage-api-url') ?? process.env.ATLAS_STORAGE_API_URL,
        }
      : {}),
    ...((args?.flag('key-prefix') ?? process.env.ATLAS_STORAGE_KEY_PREFIX)
      ? {
          prefix:
            args?.flag('key-prefix') ?? process.env.ATLAS_STORAGE_KEY_PREFIX,
        }
      : {}),
    region:
      args?.flag('region') ??
      process.env.ATLAS_S3_REGION ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      'us-east-1',
    forcePathStyle: environmentBoolean('ATLAS_S3_FORCE_PATH_STYLE'),
    lockMode: environmentS3LockMode(),
    ...(accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
          ...(process.env.ATLAS_STORAGE_SESSION_TOKEN
            ? { sessionToken: process.env.ATLAS_STORAGE_SESSION_TOKEN }
            : {}),
        }
      : {}),
  });
}

function externalPublicationLease(): AtlasPublicationLease {
  return {
    assertHeld: async () => undefined,
    release: async () => undefined,
  };
}

function s3ClientConfig(options: S3Options): S3ClientConfig {
  const credentials =
    options.accessKeyId && options.secretAccessKey
      ? {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
          ...(options.sessionToken
            ? { sessionToken: options.sessionToken }
            : {}),
        }
      : undefined;
  return {
    region: options.region ?? 'us-east-1',
    ...(credentials ? { credentials } : {}),
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.forcePathStyle !== undefined
      ? { forcePathStyle: options.forcePathStyle }
      : {}),
  };
}

function assertLease(value: unknown): DeploymentLease {
  if (typeof value !== 'object' || value === null)
    throw new Error('Atlas deployment lock is malformed.');
  const lease = value as Partial<DeploymentLease>;
  if (
    ![lease.owner, lease.token, lease.acquiredAt, lease.expiresAt].every(
      (entry) => typeof entry === 'string' && entry,
    )
  ) {
    throw new Error('Atlas deployment lock is malformed.');
  }
  if (Number.isNaN(Date.parse(lease.expiresAt!)))
    throw new Error('Atlas deployment lock expiry is invalid.');
  return lease as DeploymentLease;
}

function encodeLease(lease: DeploymentLease): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(lease)}\n`);
}

function environmentBoolean(name: string): boolean | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function environmentS3LockMode(): S3PublicationLockMode {
  const value = process.env.ATLAS_S3_LOCK_MODE;
  if (value === undefined || value === 's3') return 's3';
  if (value === 'external') return 'external';
  throw new Error('ATLAS_S3_LOCK_MODE must be "s3" or "external".');
}

function requiredEtag(etag: string | undefined): string {
  if (!etag)
    throw new Error(
      'S3-compatible storage did not return an ETag for deployment lock.',
    );
  return etag;
}

function isMissingObject(error: unknown): boolean {
  return (
    errorStatus(error) === 404 ||
    errorName(error) === 'NoSuchKey' ||
    errorName(error) === 'NotFound'
  );
}

function isPreconditionFailure(error: unknown): boolean {
  const status = errorStatus(error);
  return (
    status === 409 ||
    status === 412 ||
    errorName(error) === 'PreconditionFailed'
  );
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('$metadata' in error))
    return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata;
  return metadata?.httpStatusCode;
}

function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}

function storageError(operation: string, cause: unknown): Error {
  return new Error(`S3-compatible storage could not ${operation}.`, { cause });
}

function randomBackoffMs(): number {
  return 200 + Math.floor(Math.random() * 300);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    typeof storage.list === 'function' &&
    typeof storage.create === 'function' &&
    typeof storage.replace === 'function' &&
    typeof storage.remove === 'function' &&
    typeof storage.acquireLock === 'function'
  );
}
