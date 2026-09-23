import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker';
import type { AtlasPublicationLease } from '../publication-storage/types.js';
import { S3DeploymentLock } from './s3-lease.js';

interface StoredObject {
  body: string;
  etag: string;
}

class ConditionalPutError extends Error {
  readonly $metadata = { httpStatusCode: 412 };
}

class MissingObjectError extends Error {
  readonly $metadata = { httpStatusCode: 404 };
}

export class S3LeaseDriver {
  private readonly bucket = faker.word.noun();
  private readonly key = '.atlas/deployment.lock';
  private stored?: StoredObject;
  private etagCounter = 0;
  private timeoutMs = 50;
  private leaseMs = 3_000;
  private lease?: AtlasPublicationLease;
  private readonly puts: PutObjectCommand['input'][] = [];
  private failRenewals = false;

  readonly given = {
    timeoutMs: (timeoutMs: number) => {
      this.timeoutMs = timeoutMs;

      return this;
    },
    leaseMs: (leaseMs: number) => {
      this.leaseMs = leaseMs;

      return this;
    },
    existingLease: (expiresAt: Date, token = faker.string.uuid()) => {
      this.stored = {
        body: JSON.stringify({
          owner: faker.string.uuid(),
          token,
          acquiredAt: faker.date.past().toISOString(),
          expiresAt: expiresAt.toISOString(),
        }),
        etag: this.nextEtag(),
      };

      return this;
    },
    malformedLease: () => {
      this.stored = { body: '{"owner":1}', etag: this.nextEtag() };

      return this;
    },
    renewalsFailing: () => {
      this.failRenewals = true;

      return this;
    },
  };

  readonly when = {
    acquired: async (owner = faker.string.uuid()) => {
      this.lease = await this.lock().acquire(owner);
    },
    released: () => this.lease!.release(),
    lockTakenByAnother: () => {
      this.stored = {
        body: JSON.stringify({
          owner: faker.string.uuid(),
          token: faker.string.uuid(),
          acquiredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        etag: this.nextEtag(),
      };
    },
  };

  readonly get = {
    lease: () => this.lease!,
    storedLease: () =>
      this.stored
        ? (JSON.parse(this.stored.body) as Record<string, unknown>)
        : undefined,
    puts: () => this.puts,
  };

  private lock(): S3DeploymentLock {
    return new S3DeploymentLock({
      client: this.client(),
      bucket: this.bucket,
      key: this.key,
      timeoutMs: this.timeoutMs,
      leaseMs: this.leaseMs,
      backoffMs: () => 5,
    });
  }

  private client(): Pick<S3Client, 'send'> {
    return {
      send: async (command: unknown) => {
        if (command instanceof PutObjectCommand) return this.put(command);
        if (command instanceof GetObjectCommand) return this.read();
        if (command instanceof DeleteObjectCommand) return this.remove(command);
        throw new Error('Unexpected command.');
      },
    } as unknown as Pick<S3Client, 'send'>;
  }

  private put(command: PutObjectCommand): { ETag: string } {
    this.puts.push(command.input);
    const { IfNoneMatch, IfMatch } = command.input;
    if (IfNoneMatch === '*' && this.stored) throw new ConditionalPutError();
    if (IfMatch !== undefined) {
      if (this.failRenewals && this.puts.length > 1)
        throw new ConditionalPutError();
      if (this.stored?.etag !== IfMatch) throw new ConditionalPutError();
    }
    this.stored = {
      body: new TextDecoder().decode(command.input.Body as Uint8Array),
      etag: this.nextEtag(),
    };

    return { ETag: this.stored.etag };
  }

  private read(): {
    Body: { transformToString: () => Promise<string> };
    ETag: string;
  } {
    if (!this.stored) throw new MissingObjectError();
    const { body, etag } = this.stored;

    return { Body: { transformToString: async () => body }, ETag: etag };
  }

  private remove(command: DeleteObjectCommand): Record<string, never> {
    if (command.input.IfMatch !== this.stored?.etag)
      throw new ConditionalPutError();
    this.stored = undefined;

    return {};
  }

  private nextEtag(): string {
    this.etagCounter += 1;

    return `etag-${this.etagCounter}`;
  }
}
