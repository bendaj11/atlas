import { jest } from '@jest/globals';
import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export class BadgeRefreshDriver {
  private readonly readCount = jest.fn<() => Promise<number>>();
  private readonly publishCount = jest.fn<(count: number) => Promise<void>>();
  private readonly refresh = createBadgeRefresher({
    readCount: this.readCount,
    publishCount: this.publishCount,
  });
  private count: number | undefined;

  constructor() {
    this.publishCount.mockResolvedValue(undefined);
  }

  readonly given = {
    counts: (...counts: Array<number | Error | Deferred<number>>): this => {
      counts.forEach((count) => {
        if (count instanceof Error) this.readCount.mockRejectedValueOnce(count);
        else if (typeof count === 'number')
          this.readCount.mockResolvedValueOnce(count);
        else this.readCount.mockReturnValueOnce(count.promise);
      });

      return this;
    },
  };

  readonly when = {
    refreshed: async (): Promise<void> => {
      await this.refresh();
    },
    refreshedTwiceWhileFirstReadPends: async (
      firstRead: Deferred<number>,
      firstCount: number,
    ): Promise<void> => {
      const first = this.refresh();
      const second = this.refresh();
      firstRead.resolve(firstCount);
      await Promise.all([first, second]);
    },
    devSessionCounted: (
      session: { overrides: unknown[]; hostOverride?: unknown },
      disabledAppIds: string[] = [],
    ): void => {
      this.count = countDevSessionOverrides({
        session,
        disabledAppIds: new Set(disabledAppIds),
      });
    },
  };

  readonly get = {
    publishedCounts: (): number[] =>
      this.publishCount.mock.calls.map(([count]) => count),
    count: (): number | undefined => this.count,
  };
}

export function aDeferredCount(): Deferred<number> {
  let resolvePromise: ((value: number) => void) | undefined;
  const promise = new Promise<number>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: (value) => resolvePromise?.(value) };
}
