interface BadgeRefreshDependencies {
  readCount: () => Promise<number>;
  publishCount: (count: number) => Promise<void>;
}

interface DevSessionBadgeState {
  overrides: unknown[];
  hostOverride?: unknown;
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

export function countDevSessionOverrides(
  session: DevSessionBadgeState,
  disabledAppIds: ReadonlySet<string>,
): number {
  const enabledApps = session.overrides.filter((override) => {
    if (typeof override !== 'object' || override === null) return false;
    if (!('appId' in override)) return false;
    return (
      typeof override.appId === 'string' &&
      !disabledAppIds.has(override.appId)
    );
  });
  return enabledApps.length + (session.hostOverride ? 1 : 0);
}
