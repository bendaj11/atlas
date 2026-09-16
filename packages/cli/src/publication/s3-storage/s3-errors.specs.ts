import { faker } from '@faker-js/faker';
import { S3ErrorsDriver } from './s3-errors.driver.js';

describe('s3-errors', () => {
  let driver: S3ErrorsDriver;

  beforeEach(() => {
    driver = new S3ErrorsDriver();
  });

  describe('isMissingObject', () => {
    it.each([
      [{ $metadata: { httpStatusCode: 404 } }],
      [{ name: 'NoSuchKey' }],
      [{ name: 'NotFound' }],
    ])('should return true when error is %p', (error) => {
      driver.given.error(error);

      expect(driver.get.missing()).toBe(true);
    });

    it('should return false when error is a server failure', () => {
      driver.given.error({
        $metadata: { httpStatusCode: 500 },
        name: 'InternalError',
      });

      expect(driver.get.missing()).toBe(false);
    });
  });

  describe('isPreconditionFailure', () => {
    it.each([
      [{ $metadata: { httpStatusCode: 412 } }],
      [{ $metadata: { httpStatusCode: 409 } }],
      [{ name: 'PreconditionFailed' }],
    ])('should return true when error is %p', (error) => {
      driver.given.error(error);

      expect(driver.get.precondition()).toBe(true);
    });

    it('should return false when error is a missing object', () => {
      driver.given.error({ $metadata: { httpStatusCode: 404 } });

      expect(driver.get.precondition()).toBe(false);
    });
  });

  describe('storageError', () => {
    it('should name the operation and keep the cause when wrapped', () => {
      const cause = new Error(faker.lorem.word());
      driver.given.error(cause);

      expect(driver.get.storageError('read x')).toMatchObject({
        message: 'S3-compatible storage could not read x.',
        cause,
      });
    });
  });
});
