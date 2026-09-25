import { forEachConcurrently } from './concurrency.js';

describe('forEachConcurrently', () => {
  it('should never run more operations at once than the concurrency limit', async () => {
    let running = 0;
    let peak = 0;

    await forEachConcurrently({
      items: [1, 2, 3, 4, 5, 6, 7],
      concurrency: 3,
      operation: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
      },
    });

    expect(peak).toBe(3);
  });

  it('should start operations in item order when items are processed', async () => {
    const started: number[] = [];

    await forEachConcurrently({
      items: [1, 2, 3, 4],
      concurrency: 2,
      operation: async (item) => {
        started.push(item);
      },
    });

    expect(started).toStrictEqual([1, 2, 3, 4]);
  });

  it('should stop starting operations after one fails', async () => {
    const started: number[] = [];

    await forEachConcurrently({
      items: [1, 2, 3, 4],
      concurrency: 1,
      operation: async (item) => {
        started.push(item);

        if (item === 2) throw new Error('failed');
      },
    }).catch(() => undefined);

    expect(started).toStrictEqual([1, 2]);
  });

  it('should wait for running operations to settle before rejecting', async () => {
    let slowFinished = false;

    const outcome = forEachConcurrently({
      items: ['fail', 'slow'],
      concurrency: 2,
      operation: async (item) => {
        if (item === 'fail') throw new Error('failed');

        await new Promise((resolve) => setTimeout(resolve, 10));
        slowFinished = true;
      },
    }).catch(() => slowFinished);

    await expect(outcome).resolves.toBe(true);
  });

  it('should reject with the first failure when several operations fail', async () => {
    await expect(
      forEachConcurrently({
        items: [1, 2],
        concurrency: 2,
        operation: async (item) => {
          throw new Error(`failed ${item}`);
        },
      }),
    ).rejects.toThrow('failed 1');
  });

  it('should reject when concurrency is not a positive integer', async () => {
    await expect(
      forEachConcurrently({
        items: [1],
        concurrency: 0,
        operation: async () => undefined,
      }),
    ).rejects.toThrow('Concurrency must be a positive integer.');
  });
});
