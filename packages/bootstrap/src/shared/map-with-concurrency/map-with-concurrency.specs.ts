import { faker } from '@faker-js/faker';
import { MapWithConcurrencyDriver } from './map-with-concurrency.driver.js';

describe('mapWithConcurrency', () => {
  let driver: MapWithConcurrencyDriver;

  beforeEach(() => {
    driver = new MapWithConcurrencyDriver();
  });

  it('should return an empty list when there are no values', async () => {
    await driver.given.concurrency(3).when.mapped([]);

    expect(driver.get.results()).toEqual([]);
  });

  it('should keep results in input order when values outnumber the concurrency', async () => {
    const values = faker.helpers.uniqueArray(faker.lorem.word, 5);
    await driver.given.concurrency(2).when.mapped(values);

    expect(driver.get.results()).toEqual(
      values.map((value) => value.toUpperCase()),
    );
  });

  it('should run at most the concurrency operations at once when values outnumber it', async () => {
    await driver.given
      .concurrency(2)
      .when.mapped(faker.helpers.uniqueArray(faker.lorem.word, 5));

    expect(driver.get.maximumActiveOperations()).toBe(2);
  });

  it('should run every operation at once when values are fewer than the concurrency', async () => {
    await driver.given
      .concurrency(8)
      .when.mapped(faker.helpers.uniqueArray(faker.lorem.word, 3));

    expect(driver.get.maximumActiveOperations()).toBe(3);
  });
});
