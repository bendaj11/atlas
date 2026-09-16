import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { cliError } from '../../cli/cli-error/cli-error.js';
import { wait } from '../../shared/timers/timers.js';
import { publicationContentType } from '../publication-metadata/publication-metadata.js';
import type { AtlasPublicationLease } from '../publication-storage/publication-storage.js';
import {
  isMissingObject,
  isPreconditionFailure,
  storageError,
} from '../s3-storage/s3-errors.js';

export const DEPLOYMENT_LOCK_PATH = '.atlas/deployment.lock';
export const DEFAULT_LOCK_TIMEOUT_MS = 120_000;
export const DEFAULT_LOCK_LEASE_MS = 30_000;
export const MINIMUM_LOCK_LEASE_MS = 3_000;

export interface S3LeaseOptions {
  client: Pick<S3Client, 'send'>;
  bucket: string;
  key: string;
  timeoutMs: number;
  leaseMs: number;
  backoffMs?: () => number;
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

export class S3DeploymentLock {
  constructor(private readonly options: S3LeaseOptions) {}

  async acquire(owner: string): Promise<AtlasPublicationLease> {
    const deadline = Date.now() + this.options.timeoutMs;
    const token = randomUUID();
    let stored = await this.tryAcquire(owner, token);
    while (!stored) {
      if (Date.now() >= deadline) {
        throw cliError(
          `Timed out after ${this.options.timeoutMs}ms waiting for Atlas deployment lock.`,
          [
            'Wait for the other publisher to finish, then rerun the command.',
            `Delete a stale ${this.options.key} object only after confirming no publisher is running.`,
          ],
          { code: 'ATLAS_LOCK_TIMEOUT' },
        );
      }
      await wait((this.options.backoffMs ?? randomBackoffMs)());
      stored = await this.tryAcquire(owner, token);
    }

    return this.held(owner, token, stored.etag);
  }

  private held(
    owner: string,
    token: string,
    initialEtag: string,
  ): AtlasPublicationLease {
    let active = true;
    let leaseError: unknown;
    let currentEtag = initialEtag;
    let renewalPromise = Promise.resolve();
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRenewal = (): void => {
      renewalTimer = setTimeout(
        () => {
          renewalPromise = this.renew(owner, token, currentEtag)
            .then((etag) => {
              currentEtag = etag;
              if (active) scheduleRenewal();
            })
            .catch((error: unknown) => {
              leaseError = error;
              active = false;
            });
        },
        Math.floor(this.options.leaseMs / 3),
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
        const current = await this.read();
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
        await this.release(token);
      },
    };
  }

  private async tryAcquire(
    owner: string,
    token: string,
  ): Promise<StoredLease | undefined> {
    const lease = this.newLease(owner, token);
    try {
      const response = await this.options.client.send(
        this.putCommand(lease, { IfNoneMatch: '*' }),
      );

      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (!isPreconditionFailure(error))
        throw storageError('acquire deployment lock', error);
    }

    const existing = await this.read();
    if (!existing || Date.parse(existing.lease.expiresAt) > Date.now())
      return undefined;
    try {
      const response = await this.options.client.send(
        this.putCommand(lease, { IfMatch: existing.etag }),
      );

      return { lease, etag: requiredEtag(response.ETag) };
    } catch (error) {
      if (isPreconditionFailure(error)) return undefined;
      throw storageError('recover expired deployment lock', error);
    }
  }

  private async renew(
    owner: string,
    token: string,
    etag: string,
  ): Promise<string> {
    const response = await this.options.client.send(
      this.putCommand(this.newLease(owner, token), { IfMatch: etag }),
    );

    return requiredEtag(response.ETag);
  }

  private async release(token: string): Promise<void> {
    const current = await this.read();
    if (!current || current.lease.token !== token) return;
    try {
      await this.options.client.send(
        new DeleteObjectCommand({
          ...this.objectInput(),
          IfMatch: current.etag,
        }),
      );
    } catch (error) {
      if (!isMissingObject(error) && !isPreconditionFailure(error))
        throw storageError('release deployment lock', error);
    }
  }

  private async read(): Promise<StoredLease | undefined> {
    try {
      const response = await this.options.client.send(
        new GetObjectCommand(this.objectInput()),
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

  private putCommand(
    lease: DeploymentLease,
    condition: { IfNoneMatch?: string; IfMatch?: string },
  ): PutObjectCommand {
    return new PutObjectCommand({
      ...this.objectInput(),
      Body: new TextEncoder().encode(`${JSON.stringify(lease)}\n`),
      CacheControl: 'no-store',
      ContentType: publicationContentType('lock.json'),
      ...condition,
    });
  }

  private newLease(owner: string, token: string): DeploymentLease {
    const now = new Date();

    return {
      owner,
      token,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.valueOf() + this.options.leaseMs).toISOString(),
    };
  }

  private objectInput(): { Bucket: string; Key: string } {
    return { Bucket: this.options.bucket, Key: this.options.key };
  }
}

export function externalPublicationLease(): AtlasPublicationLease {
  return {
    assertHeld: async () => undefined,
    release: async () => undefined,
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

function requiredEtag(etag: string | undefined): string {
  if (!etag)
    throw new Error(
      'S3-compatible storage did not return an ETag for deployment lock.',
    );

  return etag;
}

function randomBackoffMs(): number {
  return 200 + Math.floor(Math.random() * 300);
}
