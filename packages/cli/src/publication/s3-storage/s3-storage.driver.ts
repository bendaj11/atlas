import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker';
import { crc32 } from 'node:zlib';
import type { AtlasPublicationObjectMetadata } from '../publication-storage/types.js';
import { S3PublicationStorage, type S3Options } from './s3-storage.js';

type Command =
  | PutObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | DeleteObjectCommand
  | ListObjectsV2Command;

export class S3StorageDriver {
  private readonly bucket = faker.word.noun();
  private options: Partial<S3Options> = {};
  private readonly commands: Command['input'][] = [];
  private readonly names: string[] = [];
  private readonly objects = new Map<
    string,
    { bytes: Uint8Array; cacheControl?: string; contentType?: string }
  >();
  private echoesChecksum = true;
  private storedBytesOverride: Uint8Array | undefined;
  private storedContentTypeOverride: string | undefined;
  private responder: (command: Command) => unknown = (command) =>
    this.emulate(command);

  readonly given = {
    options: (options: Partial<S3Options>) => {
      this.options = options;

      return this;
    },
    response: (responder: (command: Command) => unknown) => {
      this.responder = responder;

      return this;
    },
    noChecksumEcho: () => {
      this.echoesChecksum = false;

      return this;
    },
    storedContentType: (contentType: string) => {
      this.storedContentTypeOverride = contentType;

      return this;
    },
    storedBytes: (bytes: Uint8Array) => {
      this.storedBytesOverride = bytes;

      return this;
    },
    failure: (error: unknown) => {
      this.responder = () => {
        throw error;
      };

      return this;
    },
  };

  readonly when = {
    created: (path: string, metadata: AtlasPublicationObjectMetadata) =>
      this.storage().create(path, new Uint8Array([1]), metadata),
    readWithVersion: (path: string) => this.storage().readWithVersion(path),
    replaced: (
      path: string,
      condition: { versionToken?: string; createOnly?: boolean },
    ) =>
      this.storage().replace(
        path,
        new Uint8Array([1]),
        { cacheControl: 'no-cache', contentType: 'application/json' },
        condition,
      ),
  };

  readonly get = {
    read: (path: string) => this.storage().read(path),
    inspect: (path: string) => this.storage().inspect(path),
    list: (prefix: string) => this.storage().list(prefix),
    remove: (path: string) => this.storage().remove(path),
    commands: () => this.commands,
    commandNames: () => this.names,
    bucket: () => this.bucket,
  };

  private emulate(command: Command): unknown {
    const key = 'Key' in command.input ? command.input.Key : undefined;

    if (command instanceof PutObjectCommand) {
      const body = command.input.Body;
      const bytes = body instanceof Uint8Array ? body : new Uint8Array();
      this.objects.set(key!, {
        bytes: this.storedBytesOverride ?? bytes,
        ...(command.input.CacheControl
          ? { cacheControl: command.input.CacheControl }
          : {}),
        ...(command.input.ContentType
          ? {
              contentType:
                this.storedContentTypeOverride ?? command.input.ContentType,
            }
          : {}),
      });

      return this.echoesChecksum
        ? { ChecksumCRC32: crc32Checksum(this.storedBytesOverride ?? bytes) }
        : {};
    }

    const stored = key === undefined ? undefined : this.objects.get(key);

    if (command instanceof GetObjectCommand)
      return stored
        ? { Body: { transformToByteArray: async () => stored.bytes } }
        : {};

    if (command instanceof HeadObjectCommand)
      return stored
        ? {
            CacheControl: stored.cacheControl,
            ContentType: stored.contentType,
            ContentLength: stored.bytes.byteLength,
          }
        : {};

    return {};
  }

  private storage(): S3PublicationStorage {
    const client = {
      send: async (command: Command) => {
        this.commands.push(command.input);
        this.names.push(command.constructor.name);

        return this.responder(command);
      },
    } as unknown as Pick<S3Client, 'send'>;

    return new S3PublicationStorage(
      { bucket: this.bucket, ...this.options },
      client,
    );
  }
}

function crc32Checksum(bytes: Uint8Array): string {
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(bytes));

  return checksum.toString('base64');
}
