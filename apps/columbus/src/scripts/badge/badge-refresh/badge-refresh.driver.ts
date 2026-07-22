import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from './badge-refresh.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export class BadgeRefreshDriver {
  private publishedCounts: number[] = [];
  private reads: Array<() => Promise<number>> = [];
  private refresh: (() => Promise<void>) | undefined;

  readonly given = {
    countReads: (...reads: Array<() => Promise<number>>): this => {
      this.reads = reads;
      return this;
    },
  };

  readonly when = {
    refresherCreated: (): this => {
      this.refresh = createBadgeRefresher({
        readCount: () => {
          const read = this.reads.shift();
          if (!read) throw new Error('No count read configured.');
          return read();
        },
        publishCount: async (count) => {
          this.publishedCounts.push(count);
        },
      });
      return this;
    },
    refreshed: async (): Promise<this> => {
      await this.get.refresher()();
      return this;
    },
    refreshedTwiceConcurrently: async (
      firstCount: Deferred<number>,
    ): Promise<this> => {
      const refresh = this.get.refresher();
      const firstRefresh = refresh();
      const queuedRefresh = refresh();
      firstCount.resolve(1);
      await Promise.all([firstRefresh, queuedRefresh]);
      return this;
    },
  };

  readonly get = {
    publishedCounts: (): number[] => this.publishedCounts,
    refresher: (): (() => Promise<void>) => {
      if (!this.refresh) throw new Error('Refresher was not created.');
      return this.refresh;
    },
    overrideCount: (disabledAppIds = new Set<string>()): number =>
      countDevSessionOverrides({
        session: {
          overrides: [{ appId: 'orders' }, { appId: 'dashboard' }],
          hostOverride: {},
        },
        disabledAppIds,
      }),
  };

  deferredCount(): Deferred<number> {
    let resolvePromise: ((value: number) => void) | undefined;
    const promise = new Promise<number>((resolve) => {
      resolvePromise = resolve;
    });
    return {
      promise,
      resolve: (value) => resolvePromise?.(value),
    };
  }
}
