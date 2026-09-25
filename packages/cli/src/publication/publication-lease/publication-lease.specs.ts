import { faker } from '@faker-js/faker';
import { PublicationLeaseDriver } from './publication-lease.driver.js';

describe('publication-lease', () => {
  let driver: PublicationLeaseDriver;

  beforeEach(() => {
    driver = new PublicationLeaseDriver();
  });

  describe('withPublicationLease', () => {
    it('should acquire lock with process-scoped owner when operation runs', async () => {
      await driver.when.operationRun(async () => undefined);

      expect(driver.get.acquireLockMock()).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^atlas:${process.pid}:\\d+$`)),
      );
    });

    it('should return operation result when operation resolves', async () => {
      const value = faker.string.uuid();

      expect(await driver.when.operationRun(async () => value)).toBe(value);
    });

    it('should release lease when operation resolves', async () => {
      await driver.when.operationRun(async () => undefined);

      expect(driver.get.releaseMock()).toHaveBeenCalledTimes(1);
    });

    it('should release lease when operation rejects', async () => {
      await driver.when
        .operationRun(async () => {
          throw new Error(faker.lorem.word());
        })
        .catch(() => undefined);

      expect(driver.get.releaseMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyDeliveryWhileHeld', () => {
    it('should skip verification when storage has no verifyDelivery', async () => {
      driver.given.verifyDelivery(false);

      await driver.when.deliveryVerified([faker.system.filePath()]);

      expect(driver.get.events()).toStrictEqual([]);
    });

    it('should assert the lease before and after verification when storage verifies delivery', async () => {
      driver.given.verifyDelivery(true);

      await driver.when.deliveryVerified([faker.system.filePath()]);

      expect(driver.get.events()).toStrictEqual([
        'assertHeld',
        'verify',
        'assertHeld',
      ]);
    });

    it('should verify the given paths when storage verifies delivery', async () => {
      const paths = [faker.system.filePath(), faker.system.filePath()];
      driver.given.verifyDelivery(true);

      await driver.when.deliveryVerified(paths);

      expect(driver.get.verifyDeliveryMock()).toHaveBeenCalledWith(paths, {
        concurrency: 1,
      });
    });
  });
});
