import { delay } from './timers.js';

describe('wait', () => {
  it('should resolve after the delay when called', async () => {
    const started = Date.now();

    await delay(20);

    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
