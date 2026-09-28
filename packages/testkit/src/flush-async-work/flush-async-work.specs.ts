import { jest } from '@jest/globals';
import { flushAsyncWork } from './flush-async-work.js';

describe('flushAsyncWork', () => {
  it('should run a queued timer callback when awaited', async () => {
    const callback = jest.fn();
    setTimeout(callback, 0);

    await flushAsyncWork();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should run a timer queued by another timer when awaited with two rounds', async () => {
    const callback = jest.fn();
    setTimeout(() => setTimeout(callback, 0), 0);

    await flushAsyncWork(2);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
