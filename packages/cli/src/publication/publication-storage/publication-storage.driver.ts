import { faker } from '@faker-js/faker';
import { createPublicationStorage } from './publication-storage.js';

export class PublicationStorageDriver {
  private readonly accessKeyId = faker.string.alphanumeric();
  private readonly bucket = faker.word.noun();
  private externalLeaseAcquired = false;
  private readonly originalEnvironment = {
    accessKeyId: process.env.ATLAS_STORAGE_ACCESS_KEY_ID,
    bucket: process.env.ATLAS_S3_BUCKET,
    lockMode: process.env.ATLAS_S3_LOCK_MODE,
    secretAccessKey: process.env.ATLAS_STORAGE_SECRET_ACCESS_KEY,
    storage: process.env.ATLAS_STORAGE,
  };

  given = {
    environment: ({
      lockMode,
      secretAccessKey,
    }: {
      lockMode?: string;
      secretAccessKey?: 'missing';
    }): void => {
      const environment: NodeJS.ProcessEnv = {
        ATLAS_S3_BUCKET: this.bucket,
        ATLAS_STORAGE: 's3',
      };
      if (lockMode) environment.ATLAS_S3_LOCK_MODE = lockMode;
      if (secretAccessKey === 'missing')
        environment.ATLAS_STORAGE_ACCESS_KEY_ID = this.accessKeyId;
      Object.assign(process.env, environment);

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
        this.restoreEnvironment();
      }
    },
    acquireExternalLock: async (): Promise<void> => {
      try {
        const storage = await createPublicationStorage();
        const lease = await storage.acquireLock(faker.string.uuid());
        await lease.assertHeld();
        await lease.release();
        this.externalLeaseAcquired = true;
      } finally {
        this.restoreEnvironment();
      }
    },
  };

  get = {
    externalLockIsUsable: (): boolean => this.externalLeaseAcquired,
  };

  private restoreEnvironment(): void {
    this.restore('ATLAS_S3_BUCKET', this.originalEnvironment.bucket);
    this.restore('ATLAS_STORAGE', this.originalEnvironment.storage);
    this.restore('ATLAS_S3_LOCK_MODE', this.originalEnvironment.lockMode);
    this.restore(
      'ATLAS_STORAGE_ACCESS_KEY_ID',
      this.originalEnvironment.accessKeyId,
    );
    this.restore(
      'ATLAS_STORAGE_SECRET_ACCESS_KEY',
      this.originalEnvironment.secretAccessKey,
    );
  }

  private restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
