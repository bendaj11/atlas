import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import type { readHostData as readHostDataType } from '../../scripts/host/host-data/host-data';
import type {
  readDisabledArtifactVersionOverrides as readDisabledArtifactVersionOverridesType,
  readClearedLocalArtifactIds as readClearedLocalArtifactIdsType,
} from '../../scripts/overrides/override-storage/override-storage';
import type { readHostDataCache as readHostDataCacheType } from '../../scripts/host/host-data-cache/host-data-cache';

const readHostData = jest.fn<typeof readHostDataType>();
const readDisabledArtifactVersionOverrides =
  jest.fn<typeof readDisabledArtifactVersionOverridesType>();
const readClearedLocalArtifactIds =
  jest.fn<typeof readClearedLocalArtifactIdsType>();
const readHostDataCache = jest.fn<typeof readHostDataCacheType>();

jest.unstable_mockModule('../../scripts/host/host-data/host-data', () => ({
  readHostData,
}));
jest.unstable_mockModule(
  '../../scripts/overrides/override-storage/override-storage',
  () => ({ readDisabledArtifactVersionOverrides, readClearedLocalArtifactIds }),
);
jest.unstable_mockModule('../../scripts/host/host-data-cache/host-data-cache', () => ({
  readHostDataCache,
}));

interface HostRead {
  hostData: HostData;
  tabId: number;
}

export class LoadColumbusStateDriver {
  constructor() {
    jest.clearAllMocks();
    readHostDataCache.mockResolvedValue(undefined);
    readDisabledArtifactVersionOverrides.mockResolvedValue(new Map());
    readClearedLocalArtifactIds.mockResolvedValue(new Set());
  }

  readonly given = {
    hostDataCache: (cache: HostRead | undefined) => {
      readHostDataCache.mockResolvedValue(cache);

      return this;
    },
    hostDataCacheFailure: (error: Error) => {
      readHostDataCache.mockRejectedValue(error);

      return this;
    },
    hostData: (read: HostRead) => {
      readHostData.mockResolvedValue(read);

      return this;
    },
    hostDataFailure: (error: Error) => {
      readHostData.mockRejectedValue(error);

      return this;
    },
    disabledArtifactVersionOverrides: (
      overrides: Map<string, ArtifactVersion>,
    ) => {
      readDisabledArtifactVersionOverrides.mockResolvedValue(overrides);

      return this;
    },
    clearedLocalArtifactIds: (ids: Set<string>) => {
      readClearedLocalArtifactIds.mockResolvedValue(ids);

      return this;
    },
  };

  readonly get = {
    readHostData: () => readHostData,
    readHostDataCache: () => readHostDataCache,
    readDisabledArtifactVersionOverrides: () =>
      readDisabledArtifactVersionOverrides,
    readClearedLocalArtifactIds: () => readClearedLocalArtifactIds,
  };
}
