import { faker } from '@faker-js/faker';
import { S3LeaseDriver } from './s3-lease.driver.js';

describe('S3DeploymentLock', () => {
  let driver: S3LeaseDriver;

  beforeEach(() => {
    driver = new S3LeaseDriver();
  });

  describe('when no lock object exists', () => {
    const owner = faker.string.uuid();

    beforeEach(async () => {
      await driver.when.acquired(owner);
    });

    it('should write the lease with a create-only condition when acquired', () => {
      expect(driver.get.puts()[0]).toMatchObject({
        Key: '.atlas/deployment.lock',
        IfNoneMatch: '*',
        CacheControl: 'no-store',
      });
    });

    it('should store the owner in the lease when acquired', () => {
      expect(driver.get.storedLease()).toMatchObject({ owner });
    });

    it('should resolve assertHeld when the lease is still owned', async () => {
      await expect(driver.get.lease().assertHeld()).resolves.toBeUndefined();
    });

    it('should delete the lock object when released', async () => {
      await driver.when.released();

      expect(driver.get.storedLease()).toBeUndefined();
    });

    it('should reject assertHeld when another publisher took the lock', async () => {
      driver.when.lockTakenByAnother();

      await expect(driver.get.lease().assertHeld()).rejects.toThrow(
        'Atlas deployment lease is no longer owned by this publisher.',
      );
    });

    it('should keep the other publisher lock when released after losing it', async () => {
      driver.when.lockTakenByAnother();
      const other = driver.get.storedLease();

      await driver.when.released();

      expect(driver.get.storedLease()).toStrictEqual(other);
    });
  });

  it('should take over an expired lease with a version condition when the lock is stale', async () => {
    driver.given.existingLease(faker.date.past());

    await driver.when.acquired();

    expect(driver.get.puts().at(-1)).toMatchObject({ IfMatch: 'etag-1' });
  });

  it('should reject with lock-timeout code when the lock stays held past the timeout', async () => {
    driver.given.timeoutMs(30).given.existingLease(faker.date.future());

    await expect(driver.when.acquired()).rejects.toMatchObject({
      code: 'ATLAS_LOCK_TIMEOUT',
    });
  });

  it('should reject when the stored lock is malformed', async () => {
    driver.given.malformedLease();

    await expect(driver.when.acquired()).rejects.toMatchObject({
      message: 'S3-compatible storage could not read deployment lock.',
      cause: expect.objectContaining({
        message: 'Atlas deployment lock is malformed.',
      }),
    });
  });
});
