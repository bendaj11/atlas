import { faker } from '@faker-js/faker';
import { ErrorsDriver } from './errors.driver.js';

describe('errors', () => {
  let driver: ErrorsDriver;

  beforeEach(() => {
    driver = new ErrorsDriver();
  });

  describe('extractErrorMessage', () => {
    it('should return message when value is an Error', () => {
      const message = faker.lorem.sentence();
      driver.given.error(new Error(message));

      expect(driver.get.message()).toBe(message);
    });

    it('should stringify value when value is not an Error', () => {
      const value = faker.number.int();
      driver.given.error(value);

      expect(driver.get.message()).toBe(String(value));
    });
  });

  describe('extractHttpStatus', () => {
    it('should read SDK metadata status when $metadata carries a number', () => {
      const status = faker.internet.httpStatusCode();
      driver.given.error({ $metadata: { httpStatusCode: status } });

      expect(driver.get.status()).toBe(status);
    });

    it('should read status field when error carries a numeric status', () => {
      const status = faker.internet.httpStatusCode();
      driver.given.error(Object.assign(new Error(), { status }));

      expect(driver.get.status()).toBe(status);
    });

    it('should return undefined when status is not a number', () => {
      driver.given.error({ status: String(faker.internet.httpStatusCode()) });

      expect(driver.get.status()).toBeUndefined();
    });

    it('should return undefined when value is not an object', () => {
      driver.given.error(faker.lorem.word());

      expect(driver.get.status()).toBeUndefined();
    });
  });

  describe('extractErrorCause', () => {
    it('should return cause when error carries one', () => {
      const cause = new Error(faker.lorem.word());
      driver.given.error(new Error(faker.lorem.word(), { cause }));

      expect(driver.get.cause()).toBe(cause);
    });

    it('should return undefined when value has no cause', () => {
      driver.given.error(new Error(faker.lorem.word()));

      expect(driver.get.cause()).toBeUndefined();
    });
  });
});
