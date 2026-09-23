import { NetworkLimiter } from './network-limiter.js';

export class NetworkLimiterDriver {
  private limit = 1;
  private active = 0;
  private peak = 0;

  readonly given = {
    limit: (limit: number) => {
      this.limit = limit;

      return this;
    },
  };

  readonly when = {
    operationsRun: async (count: number) => {
      const limiter = new NetworkLimiter(this.limit);
      await Promise.all(
        Array.from({ length: count }, () =>
          limiter.run(async () => {
            this.active += 1;
            this.peak = Math.max(this.peak, this.active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            this.active -= 1;
          }),
        ),
      );
    },
  };

  readonly get = {
    peakConcurrency: () => this.peak,
    construction: () => () => new NetworkLimiter(this.limit),
  };
}
