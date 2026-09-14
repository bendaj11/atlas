import { mapWithConcurrency } from './concurrency';

export class ConcurrencyDriver {
  private inFlight = 0;
  private peakInFlight = 0;
  private results: number[] = [];

  readonly when = {
    mapped: async (values: number[], concurrency: number): Promise<this> => {
      this.results = await mapWithConcurrency(
        values,
        async (value) => {
          this.inFlight += 1;
          this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
          await Promise.resolve();
          this.inFlight -= 1;

          return value * 2;
        },
        concurrency,
      );

      return this;
    },
  };

  readonly get = {
    results: (): number[] => this.results,
    peakInFlight: (): number => this.peakInFlight,
  };
}
