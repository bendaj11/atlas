import { faker } from '@faker-js/faker';
import { RecordsDriver } from './records.driver.js';

const NON_RECORDS = [null, undefined, 1, 'text', true, [1]] as const;

describe('records', () => {
  let driver: RecordsDriver;

  beforeEach(() => {
    driver = new RecordsDriver();
  });

  describe('isRecord', () => {
    it('should return true when value is a plain object', () => {
      driver.given.value({ [faker.lorem.word()]: faker.lorem.word() });

      expect(driver.get.isRecord()).toBe(true);
    });

    it.each(NON_RECORDS)('should return false when value is %p', (value) => {
      driver.given.value(value);

      expect(driver.get.isRecord()).toBe(false);
    });
  });

  describe('optionalRecord', () => {
    it('should return the object when value is a plain object', () => {
      const value = { [faker.lorem.word()]: faker.lorem.word() };
      driver.given.value(value);

      expect(driver.get.optionalRecord()).toBe(value);
    });

    it.each(NON_RECORDS)(
      'should return undefined when value is %p',
      (value) => {
        driver.given.value(value);

        expect(driver.get.optionalRecord()).toBeUndefined();
      },
    );
  });

  describe('isNonEmptyString', () => {
    it('should return true when value is a non-empty string', () => {
      driver.given.value(faker.lorem.word());

      expect(driver.get.isNonEmptyString()).toBe(true);
    });

    it.each(['', 0, null, undefined])(
      'should return false when value is %p',
      (value) => {
        driver.given.value(value);

        expect(driver.get.isNonEmptyString()).toBe(false);
      },
    );
  });
});
