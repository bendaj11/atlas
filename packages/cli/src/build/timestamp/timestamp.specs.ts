import { faker } from '@faker-js/faker';
import { TimestampDriver } from './timestamp.driver.js';

describe('buildTimestamp', () => {
  let driver: TimestampDriver;

  beforeEach(() => {
    driver = new TimestampDriver();
  });

  it('should normalize ATLAS_CREATED_AT to ISO when it is set', () => {
    const date = faker.date.past();
    driver.given.environment({ ATLAS_CREATED_AT: date.toISOString() });

    expect(driver.get.timestamp()).toBe(date.toISOString());
  });

  it('should throw when ATLAS_CREATED_AT is not a date', () => {
    driver.given.environment({ ATLAS_CREATED_AT: 'yesterday' });

    expect(() => driver.get.timestamp()).toThrow(
      'ATLAS_CREATED_AT must be an ISO-8601 timestamp, received "yesterday".',
    );
  });

  it('should convert SOURCE_DATE_EPOCH seconds when it is set', () => {
    const seconds = faker.number.int({ min: 1, max: 2_000_000_000 });
    driver.given.environment({ SOURCE_DATE_EPOCH: String(seconds) });

    expect(driver.get.timestamp()).toBe(new Date(seconds * 1000).toISOString());
  });

  it('should throw when SOURCE_DATE_EPOCH is negative', () => {
    driver.given.environment({ SOURCE_DATE_EPOCH: '-1' });

    expect(() => driver.get.timestamp()).toThrow(
      'SOURCE_DATE_EPOCH must be a non-negative integer, received "-1".',
    );
  });

  it('should prefer ATLAS_CREATED_AT when both variables are set', () => {
    const date = faker.date.past();
    driver.given.environment({
      ATLAS_CREATED_AT: date.toISOString(),
      SOURCE_DATE_EPOCH: '0',
    });

    expect(driver.get.timestamp()).toBe(date.toISOString());
  });

  it('should return the current time when neither variable is set', () => {
    const before = Date.now();

    expect(Date.parse(driver.get.timestamp())).toBeGreaterThanOrEqual(before);
  });
});
