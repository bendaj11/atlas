import { mapWithConcurrency } from './map-with-concurrency.js';

export class MapWithConcurrencyDriver {
  private concurrency = 1;
  private activeOperations = 0;
  private maximumActiveOperations = 0;
  private results: unknown[] = [];
  private error: unknown;

  readonly given = {
    concurrency: (concurrency: number): MapWithConcurrencyDriver => {
      this.concurrency = concurrency;

      return this;
    },
  };

  readonly when = {
    mapped: async (values: readonly string[]): Promise<void> => {
      try {
        this.results = await mapWithConcurrency({
          values,
          operation: (value) => this.track(value),
          concurrency: this.concurrency,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    results: (): unknown[] => this.results,
    maximumActiveOperations: (): number => this.maximumActiveOperations,
    error: (): unknown => this.error,
  };

  private async track(value: string): Promise<string> {
    this.activeOperations += 1;
    this.maximumActiveOperations = Math.max(
      this.maximumActiveOperations,
      this.activeOperations,
    );
    await Promise.resolve();
    this.activeOperations -= 1;

    return value.toUpperCase();
  }
}
