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
});
