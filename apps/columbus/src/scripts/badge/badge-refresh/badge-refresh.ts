interface BadgeRefreshDependencies {
  readCount: () => Promise<number>;
  publishCount: (count: number) => Promise<void>;
}

export function createBadgeRefresher({
  readCount,
  publishCount,
}: BadgeRefreshDependencies): () => Promise<void> {
  let refreshQueued = false;
  let activeRefresh: Promise<void> | undefined;
  let publishedCount: number | undefined;

  async function drainRefreshQueue(): Promise<void> {
    while (refreshQueued) {
      refreshQueued = false;
      try {
        const count = await readCount();
        if (count === publishedCount) continue;
        await publishCount(count);
        publishedCount = count;
      } catch {
        continue;
      }
    }
  }

  function refresh(): Promise<void> {
    refreshQueued = true;
    if (!activeRefresh) {
      activeRefresh = drainRefreshQueue().finally(() => {
        activeRefresh = undefined;
        if (refreshQueued) void refresh();
      });
    }
    return activeRefresh;
  }

  return refresh;
}
