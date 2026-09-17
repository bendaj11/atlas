import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('should return an empty list when there are no values', async () => {
    const operation = jest.fn<(value: number) => Promise<number>>();

    expect(await mapWithConcurrency([], operation, 2)).toStrictEqual([]);
  });

  it('should keep results in input order when operations run concurrently', async () => {
    const values = [1, 2, 3, 4];
    const operation = jest.fn(async (value: number) => value * 2);

    expect(await mapWithConcurrency(values, operation, 2)).toStrictEqual([
      2, 4, 6, 8,
    ]);
  });

  it('should start only as many operations as the concurrency limit when operations are pending', async () => {
    const values = faker.helpers.multiple(() => faker.number.int(), {
      count: 5,
    });
    const operation = jest
      .fn<(value: number) => Promise<number>>()
      .mockReturnValue(new Promise(() => undefined));

    void mapWithConcurrency(values, operation, 2);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(operation).toHaveBeenCalledTimes(2);
  });
});
