import { jest } from '@jest/globals';
import type { ColumbusState } from '../../types/columbus-state';
import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import type { readHostData as readHostDataType } from '../../scripts/host/host-data/host-data';
import type {
  readDisabledArtifactVersionOverrides as readDisabledOverridesType,
  readClearedLocalArtifactIds as readSuppressedArtifactIdsType,
} from '../../scripts/overrides/override-storage/override-storage';
import type { readHostDataCache as readHostDataCacheType } from '../../scripts/host/host-data-cache';

const readHostData = jest.fn<typeof readHostDataType>();
const readDisabledArtifactVersionOverrides =
  jest.fn<typeof readDisabledOverridesType>();
const readClearedLocalArtifactIds =
  jest.fn<typeof readSuppressedArtifactIdsType>();
const readHostDataCache = jest.fn<typeof readHostDataCacheType>();

jest.unstable_mockModule('../../scripts/host/host-data/host-data', () => ({
  readHostData,
}));
jest.unstable_mockModule(
  '../../scripts/overrides/override-storage/override-storage',
  () => ({ readDisabledArtifactVersionOverrides, readClearedLocalArtifactIds }),
);
jest.unstable_mockModule('../../scripts/host/host-data-cache', () => ({
  readHostDataCache,
}));

const { hostStatusOf, loadColumbusState } = await import('./columbus-state');

export class ColumbusStateDriver {
  private hasColumbusState = false;
  private columbusState: ColumbusState | undefined;
  private failure: Error | undefined;

  constructor() {
    jest.clearAllMocks();
    readHostDataCache.mockResolvedValue(undefined);
    readDisabledArtifactVersionOverrides.mockResolvedValue(new Map());
    readClearedLocalArtifactIds.mockResolvedValue(new Set());
  }

  readonly given = {
    hasColumbusState: (hasColumbusState: boolean): this => {
      this.hasColumbusState = hasColumbusState;

      return this;
    },
    cachedHost: (hostData: HostData, tabId: number): this => {
      readHostDataCache.mockResolvedValue({ hostData, tabId });

      return this;
    },
    cacheReadFailure: (): this => {
      readHostDataCache.mockRejectedValue(new Error('Cache unavailable.'));

      return this;
    },
    activeHost: (hostData: HostData, tabId: number): this => {
      readHostData.mockResolvedValue({ hostData, tabId });

      return this;
    },
    activeHostReadFailure: (reason: string): this => {
      readHostData.mockRejectedValue(new Error(reason));

      return this;
    },
    disabledArtifactVersionOverrides: (
      overrides: Map<string, ArtifactVersion>,
    ): this => {
      readDisabledArtifactVersionOverrides.mockResolvedValue(overrides);

      return this;
    },
    clearedLocalArtifactIds: (ids: Set<string>): this => {
      readClearedLocalArtifactIds.mockResolvedValue(ids);

      return this;
    },
  };

  readonly when = {
    columbusStateLoaded: async (): Promise<void> => {
      try {
        this.columbusState = await loadColumbusState(this.hasColumbusState);
      } catch (error) {
        this.failure = error as Error;
      }
    },
  };

  readonly get = {
    columbusState: (): ColumbusState | undefined => this.columbusState,
    failureMessage: (): string | undefined => this.failure?.message,
    hostStatus: (query: { isError: boolean; isFetching: boolean }) =>
      hostStatusOf(query),
    activeHostReadCount: (): number => readHostData.mock.calls.length,
    cacheReadCount: (): number => readHostDataCache.mock.calls.length,
    disabledOverridesRequest: () =>
      readDisabledArtifactVersionOverrides.mock.calls[0]?.[0],
  };
}
