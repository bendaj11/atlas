import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { publicationContentType } from "./publication-metadata.js";

export interface AtlasPublicationStorage {
  read(path: string): Promise<Uint8Array | undefined>;
  inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined>;
  create(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void>;
  replace(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void>;
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
}

export type AtlasPublicationStorageSource = AtlasPublicationStorage
  | (() => AtlasPublicationStorage | Promise<AtlasPublicationStorage>);

export async function createPublicationStorage(storage?: AtlasPublicationStorageSource): Promise<AtlasPublicationStorage> {
  const configured = storage ?? storageFromEnvironment();
  if (!configured) {
    throw new Error("Publication storage is required. Set ATLAS_STORAGE=s3 and ATLAS_S3_BUCKET, or configure custom storage in atlas.publish.ts.");
  }
  const resolvedStorage = typeof configured === "function" ? await configured() : configured;
  if (!isPublicationStorage(resolvedStorage)) throw new Error("Publication storage must implement AtlasPublicationStorage.");
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
  lockTimeoutMs?: number;
  lockLeaseMs?: number;
}

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

const DEPLOYMENT_LOCK_PATH = ".atlas/deployment.lock";
const DEFAULT_LOCK_TIMEOUT_MS = 120_000;
const DEFAULT_LOCK_LEASE_MS = 30_000;
const MINIMUM_LOCK_LEASE_MS = 3_000;

export class S3PublicationStorage implements AtlasPublicationStorage {
  private readonly client: S3Client;
  private readonly prefix: string;
  private readonly lockTimeoutMs: number;
  private readonly lockLeaseMs: number;

  constructor(private readonly options: S3Options) {
    if (!options.bucket) throw new Error("S3 publication storage requires a bucket.");
    this.prefix = options.prefix?.replace(/^\/+|\/+$/g, "") ?? "";
    this.lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.lockLeaseMs = options.lockLeaseMs ?? DEFAULT_LOCK_LEASE_MS;
    if (this.lockTimeoutMs < 0) throw new Error("S3 lock timeout must not be negative.");
    if (this.lockLeaseMs < MINIMUM_LOCK_LEASE_MS) {
      throw new Error(`S3 lock lease must be at least ${MINIMUM_LOCK_LEASE_MS}ms.`);
    }
    this.client = new S3Client(s3ClientConfig(options));
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try {
      const response = await this.client.send(new GetObjectCommand(this.objectInput(path)));
      return response.Body ? await response.Body.transformToByteArray() : new Uint8Array();
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError(`read ${path}`, error);
    }
  }

  async inspect(path: string): Promise<AtlasPublicationObjectMetadata | undefined> {
    try {
      const response = await this.client.send(new HeadObjectCommand(this.objectInput(path)));
      if (!response.CacheControl || !response.ContentType) {
        throw new Error(`Published object ${path} is missing Cache-Control or Content-Type metadata.`);
      }
      return { cacheControl: response.CacheControl, contentType: response.ContentType };
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError(`inspect ${path}`, error);
    }
  }

  async create(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({
        ...this.objectInput(path), Body: bytes, CacheControl: metadata.cacheControl,
        ContentType: metadata.contentType, IfNoneMatch: "*"
      }));
    } catch (error) {
      if (isPreconditionFailure(error)) throw new Error(`Immutable publication object already exists: ${path}`, { cause: error });
      throw storageError(`create ${path}`, error);
    }
  }

  async replace(path: string, bytes: Uint8Array, metadata: AtlasPublicationObjectMetadata): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({
        ...this.objectInput(path), Body: bytes, CacheControl: metadata.cacheControl,
        ContentType: metadata.contentType
      }));
    } catch (error) {
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
    const deadline = Date.now() + this.lockTimeoutMs;
    const token = randomUUID();
    let stored = await this.tryAcquireLease(owner, token);
    while (!stored) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out after ${this.lockTimeoutMs}ms waiting for Atlas deployment lock.`);
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
      renewalTimer = setTimeout(() => {
        renewalPromise = this.renewLease(owner, token, currentEtag)
          .then((etag) => {
            currentEtag = etag;
            if (active) scheduleRenewal();
          })
          .catch((error: unknown) => {
            leaseError = error;
            active = false;
          });
      }, Math.floor(this.lockLeaseMs / 3));
      renewalTimer.unref();
    };
    scheduleRenewal();

    return {
      assertHeld: async () => {
        if (leaseError) throw new Error("Atlas deployment lease renewal failed; publication stopped before further mutation.", { cause: leaseError });
        const current = await this.readLease();
        if (!current || current.lease.token !== token || Date.parse(current.lease.expiresAt) <= Date.now()) {
          active = false;
          throw new Error("Atlas deployment lease is no longer owned by this publisher.");
        }
      },
      release: async () => {
        if (renewalTimer) clearTimeout(renewalTimer);
        active = false;
        await renewalPromise;
        if (leaseError) throw new Error("Atlas deployment lease was lost during publication.", { cause: leaseError });
        await this.releaseLease(token);
      }
    };
  }

  private async tryAcquireLease(owner: string, token: string): Promise<StoredLease | undefined> {
    const lease = this.newLease(owner, token);
    try {
      const response = await this.client.send(new PutObjectCommand({
        ...this.objectInput(DEPLOYMENT_LOCK_PATH), Body: encodeLease(lease),
        CacheControl: "no-store", ContentType: publicationContentType("lock.json"), IfNoneMatch: "*"
      }));
      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (!isPreconditionFailure(error)) throw storageError("acquire deployment lock", error);
    }

    const existing = await this.readLease();
    if (!existing || Date.parse(existing.lease.expiresAt) > Date.now()) return undefined;
    try {
      const response = await this.client.send(new PutObjectCommand({
        ...this.objectInput(DEPLOYMENT_LOCK_PATH), Body: encodeLease(lease),
        CacheControl: "no-store", ContentType: publicationContentType("lock.json"), IfMatch: existing.etag
      }));
      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (isPreconditionFailure(error)) return undefined;
      throw storageError("recover expired deployment lock", error);
    }
  }

  private async renewLease(owner: string, token: string, etag: string): Promise<string> {
    const response = await this.client.send(new PutObjectCommand({
      ...this.objectInput(DEPLOYMENT_LOCK_PATH), Body: encodeLease(this.newLease(owner, token)),
      CacheControl: "no-store", ContentType: publicationContentType("lock.json"), IfMatch: etag
    }));
    return requiredEtag(response.ETag);
  }

  private async releaseLease(token: string): Promise<void> {
    const current = await this.readLease();
    if (!current || current.lease.token !== token) return;
    try {
      await this.client.send(new DeleteObjectCommand({ ...this.objectInput(DEPLOYMENT_LOCK_PATH), IfMatch: current.etag }));
    } catch (error) {
      if (!isMissingObject(error) && !isPreconditionFailure(error)) throw storageError("release deployment lock", error);
    }
  }

  private async readLease(): Promise<StoredLease | undefined> {
    try {
      const response = await this.client.send(new GetObjectCommand(this.objectInput(DEPLOYMENT_LOCK_PATH)));
      if (!response.Body || !response.ETag) return undefined;
      const value = JSON.parse(await response.Body.transformToString()) as unknown;
      return { lease: assertLease(value), etag: response.ETag };
    } catch (error) {
      if (isMissingObject(error)) return undefined;
      throw storageError("read deployment lock", error);
    }
  }

  private newLease(owner: string, token: string): DeploymentLease {
    const now = new Date();
    return {
      owner,
      token,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.valueOf() + this.lockLeaseMs).toISOString()
    };
  }

  private objectInput(path: string): { Bucket: string; Key: string } {
    return { Bucket: this.options.bucket, Key: [this.prefix, path].filter(Boolean).join("/") };
  }
}

function storageFromEnvironment(): AtlasPublicationStorage | undefined {
  const provider = process.env.ATLAS_STORAGE;
  const bucket = process.env.ATLAS_S3_BUCKET;
  if (!provider && !bucket) return undefined;
  if (provider && provider !== "s3") throw new Error(`Unsupported ATLAS_STORAGE provider "${provider}".`);
  if (!bucket) throw new Error("ATLAS_S3_BUCKET is required when ATLAS_STORAGE=s3.");
  const accessKeyId = process.env.ATLAS_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ATLAS_S3_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("ATLAS_S3_ACCESS_KEY_ID and ATLAS_S3_SECRET_ACCESS_KEY must be set together.");
  }
  return new S3PublicationStorage({
    bucket,
    ...(process.env.ATLAS_S3_ENDPOINT ? { endpoint: process.env.ATLAS_S3_ENDPOINT } : {}),
    ...(process.env.ATLAS_S3_PREFIX ? { prefix: process.env.ATLAS_S3_PREFIX } : {}),
    region: process.env.ATLAS_S3_REGION ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    forcePathStyle: environmentBoolean("ATLAS_S3_FORCE_PATH_STYLE"),
    ...(accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey,
      ...(process.env.ATLAS_S3_SESSION_TOKEN ? { sessionToken: process.env.ATLAS_S3_SESSION_TOKEN } : {})
    } : {})
  });
}

function s3ClientConfig(options: S3Options): S3ClientConfig {
  const credentials = options.accessKeyId && options.secretAccessKey
    ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey, ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}) }
    : defaultProvider();
  return {
    region: options.region ?? "us-east-1",
    credentials,
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.forcePathStyle !== undefined ? { forcePathStyle: options.forcePathStyle } : {})
  };
}

function assertLease(value: unknown): DeploymentLease {
  if (typeof value !== "object" || value === null) throw new Error("Atlas deployment lock is malformed.");
  const lease = value as Partial<DeploymentLease>;
  if (![lease.owner, lease.token, lease.acquiredAt, lease.expiresAt].every((entry) => typeof entry === "string" && entry)) {
    throw new Error("Atlas deployment lock is malformed.");
  }
  if (Number.isNaN(Date.parse(lease.expiresAt!))) throw new Error("Atlas deployment lock expiry is invalid.");
  return lease as DeploymentLease;
}

function encodeLease(lease: DeploymentLease): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(lease)}\n`);
}

function environmentBoolean(name: string): boolean | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function requiredEtag(etag: string | undefined): string {
  if (!etag) throw new Error("S3-compatible storage did not return an ETag for deployment lock.");
  return etag;
}

function isMissingObject(error: unknown): boolean {
  return errorStatus(error) === 404 || errorName(error) === "NoSuchKey" || errorName(error) === "NotFound";
}

function isPreconditionFailure(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 409 || status === 412 || errorName(error) === "PreconditionFailed";
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode;
}

function errorName(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "name" in error
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

export function isPublicationStorage(value: unknown): value is AtlasPublicationStorage {
  if (typeof value !== "object" || value === null) return false;
  const storage = value as Partial<AtlasPublicationStorage>;
  return typeof storage.read === "function"
    && typeof storage.inspect === "function"
    && typeof storage.create === "function"
    && typeof storage.replace === "function"
    && typeof storage.remove === "function"
    && typeof storage.acquireLock === "function";
}
