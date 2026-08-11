import { beforeEach, describe, expect, it } from '@jest/globals';
import { PublicationStorageDriver } from './publication-storage.driver.js';

describe('createPublicationStorage', () => {
  let driver: PublicationStorageDriver;

  beforeEach(() => {
    driver = new PublicationStorageDriver();
  });

  it('should reject storage configuration when secret access key is missing', async () => {
    driver.given.environment({ secretAccessKey: 'missing' });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together.',
    );
  });

  it('should use external lease when external locking is configured', async () => {
    driver.given.environment({ lockMode: 'external' });

    await driver.when.acquireExternalLock();

    expect(driver.get.externalLockIsUsable()).toBe(true);
  });

  it('should reject storage configuration when lock mode is unsupported', async () => {
    driver.given.environment({ lockMode: 'unsupported' });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_S3_LOCK_MODE must be "s3" or "external".',
    );
  });
});
