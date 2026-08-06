import { faker } from '@faker-js/faker';
import { createPublicationStorage } from './publication-storage.js';

export class PublicationStorageDriver {
  private readonly accessKeyId = faker.string.alphanumeric();
  private readonly bucket = faker.word.noun();
  private readonly originalEnvironment = {
    accessKeyId: process.env.ATLAS_STORAGE_ACCESS_KEY_ID,
    bucket: process.env.ATLAS_S3_BUCKET,
    secretAccessKey: process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY,
    storage: process.env.ATLAS_STORAGE,
  };

  given = {
    environment: ({
      secretAccessKey,
    }: {
      secretAccessKey: 'missing';
    }): void => {
      Object.assign(process.env, {
        ATLAS_S3_BUCKET: this.bucket,
        ATLAS_STORAGE: 's3',
        ATLAS_STORAGE_ACCESS_KEY_ID: this.accessKeyId,
      });

      if (secretAccessKey === 'missing') {
        delete process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY;
      }
    },
  };

  when = {
    create: async (): Promise<void> => {
      try {
        await createPublicationStorage();
      } finally {
        this.restore('ATLAS_S3_BUCKET', this.originalEnvironment.bucket);
        this.restore('ATLAS_STORAGE', this.originalEnvironment.storage);
        this.restore(
          'ATLAS_STORAGE_ACCESS_KEY_ID',
          this.originalEnvironment.accessKeyId,
        );
        this.restore(
          'ATLAS_STORAGE_SECRET_ACCESS_KEY',
          this.originalEnvironment.secretAccessKey,
        );
      }
    },
  };

  private restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
