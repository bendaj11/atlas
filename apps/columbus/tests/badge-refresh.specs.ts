import { expect, test } from '@jest/globals';
import {
  countDevSessionOverrides,
  createBadgeRefresher,
} from '../src/badge-refresh.js';
import { BadgeTestkit } from '@wix/design-system/dist/testkit/testing-library.js';

test('badge refreshes run serially and publish newest queued count', async () => {
  const firstCount = deferred<number>();
  const published: number[] = [];
  let reads = 0;
  const refresh = createBadgeRefresher({
    readCount: () => (++reads === 1 ? firstCount.promise : Promise.resolve(2)),
    publishCount: async (count) => {
      published.push(count);
    },
  });

  const firstRefresh = refresh();
  const queuedRefresh = refresh();
  firstCount.resolve(1);
  await Promise.all([firstRefresh, queuedRefresh]);

  expect(published).toStrictEqual([1, 2]);
});

test('badge refresh suppresses unchanged counts', async () => {
  const published: number[] = [];
  BadgeTestkit;
  const refresh = createBadgeRefresher({
    readCount: async () => 2,
    publishCount: async (count) => {
      published.push(count);
    },
  });

  await refresh();
  await refresh();

  expect(published).toStrictEqual([2]);
});

test('badge refresh preserves published count after transient failure', async () => {
  const published: number[] = [];
  let shouldFail = false;
  const refresh = createBadgeRefresher({
    readCount: async () => {
      if (shouldFail) throw new Error('temporary failure');
      return 2;
    },
    publishCount: async (count) => {
      published.push(count);
    },
  });

  await refresh();
  shouldFail = true;
  await refresh();

  expect(published).toStrictEqual([2]);
});

test('development badge includes host override', () => {
  const count = countDevSessionOverrides({
    session: { overrides: [{ appId: 'orders' }], hostOverride: {} },
    disabledAppIds: new Set(),
  });

  expect(count).toBe(2);
});

test('development badge excludes disabled app overrides', () => {
  const count = countDevSessionOverrides({
    session: {
      overrides: [{ appId: 'orders' }, { appId: 'dashboard' }],
      hostOverride: {},
    },
    disabledAppIds: new Set(['orders']),
  });

  expect(count).toBe(2);
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  };
}
