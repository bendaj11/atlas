import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker';
import type {
  AtlasPublicationListedObject,
  AtlasPublicationObjectMetadata,
} from '../publication-storage/types.js';
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
  private responder: (command: Command) => unknown = () => ({});

  readonly given = {
    options: (options: Partial<S3Options>): this => {
      this.options = options;

      return this;
    },
    response: (responder: (command: Command) => unknown): this => {
      this.responder = responder;

      return this;
    },
    failure: (error: unknown): this => {
      this.responder = () => {
        throw error;
      };

      return this;
    },
  };

  readonly when = {
    created: (path: string, metadata: AtlasPublicationObjectMetadata) =>
      this.storage().create(path, new Uint8Array([1]), metadata),
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
    list: (prefix: string): Promise<AtlasPublicationListedObject[]> =>
      this.storage().list(prefix),
    remove: (path: string) => this.storage().remove(path),
    commands: (): readonly Command['input'][] => this.commands,
    bucket: (): string => this.bucket,
  };

  private storage(): S3PublicationStorage {
    const client = {
      send: async (command: Command) => {
        this.commands.push(command.input);

        return this.responder(command);
      },
    } as unknown as Pick<S3Client, 'send'>;

    return new S3PublicationStorage(
      { bucket: this.bucket, ...this.options },
      client,
    );
  }
}
