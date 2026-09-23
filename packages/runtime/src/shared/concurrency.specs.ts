import { faker } from '@faker-js/faker';
import { mapWithConcurrency } from './concurrency.js';

describe('mapWithConcurrency', () => {
  it('should return results in input order when operations resolve out of order', async () => {
    const values = [30, 10, 20];

    const results = await mapWithConcurrency(
      values,
      (value) =>
        new Promise<number>((resolve) =>
          setTimeout(() => resolve(value * 2), value),
        ),
    );

    expect(results).toEqual([60, 20, 40]);
  });

  it('should run at most the given number of operations at once when the concurrency is limited', async () => {
    let active = 0;
    let peak = 0;
    const values = Array.from({ length: 6 }, () => faker.number.int());

    await mapWithConcurrency(
      values,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
      },
      2,
    );

    expect(peak).toBe(2);
  });

  it('should return an empty array when no values are given', async () => {
    expect(await mapWithConcurrency([], async () => undefined)).toEqual([]);
  });
});
