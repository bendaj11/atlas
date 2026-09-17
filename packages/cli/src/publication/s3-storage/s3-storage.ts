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
import type {
  AtlasPublicationBody,
  AtlasPublicationLease,
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
  AtlasPublicationReplaceCondition,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';
import {
  DEFAULT_LOCK_LEASE_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEPLOYMENT_LOCK_PATH,
  MINIMUM_LOCK_LEASE_MS,
  S3DeploymentLock,
  externalPublicationLease,
} from '../s3-lease/s3-lease.js';
import {
  isMissingObject,
  isPreconditionFailure,
  storageError,
} from './s3-errors.js';

export type S3PublicationLockMode = 'external' | 's3';

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

export class S3PublicationStorage implements AtlasPublicationStorage {
  private readonly client: Pick<S3Client, 'send'>;
  private readonly prefix: string;
  private readonly lock: S3DeploymentLock;

  constructor(
    private readonly options: S3Options,
    client?: Pick<S3Client, 'send'>,
  ) {
    if (!options.bucket)
      throw new Error('S3 publication storage requires a bucket.');
    this.prefix = options.prefix?.replace(/^\/+|\/+$/g, '') ?? '';
    const lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const lockLeaseMs = options.lockLeaseMs ?? DEFAULT_LOCK_LEASE_MS;

    if (lockTimeoutMs < 0)
      throw new Error('S3 lock timeout must not be negative.');
    if (lockLeaseMs < MINIMUM_LOCK_LEASE_MS) {
      throw new Error(
        `S3 lock lease must be at least ${MINIMUM_LOCK_LEASE_MS}ms.`,
      );
    }
    this.client = client ?? new S3Client(s3ClientConfig(options));
    this.lock = new S3DeploymentLock({
      client: this.client,
      bucket: options.bucket,
      key: this.objectKey(DEPLOYMENT_LOCK_PATH),
      timeoutMs: lockTimeoutMs,
      leaseMs: lockLeaseMs,
    });
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
    const response = await this.client
      .send(new HeadObjectCommand(this.objectInput(path)))
      .catch((error: unknown) => {
        if (isMissingObject(error)) return undefined;
        throw storageError(`inspect ${path}`, error);
      });
    if (!response) return undefined;

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
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    const objects: AtlasPublicationListedObject[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client
        .send(
          new ListObjectsV2Command({
            Bucket: this.options.bucket,
            Prefix: this.objectKey(prefix),
            ...(continuationToken
              ? { ContinuationToken: continuationToken }
              : {}),
          }),
        )
        .catch((error: unknown) => {
          throw storageError(`list ${prefix}`, error);
        });
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
          Body: uploadBodyOf(bytes),
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
          Body: uploadBodyOf(bytes),
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

  acquireLock(owner: string): Promise<AtlasPublicationLease> {
    if (this.options.lockMode === 'external')
      return Promise.resolve(externalPublicationLease());

    return this.lock.acquire(owner);
  }

  private objectInput(path: string): { Bucket: string; Key: string } {
    return { Bucket: this.options.bucket, Key: this.objectKey(path) };
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

function uploadBodyOf(body: AtlasPublicationBody): Uint8Array | Readable {
  return body instanceof Uint8Array ? body : Readable.from(body);
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
