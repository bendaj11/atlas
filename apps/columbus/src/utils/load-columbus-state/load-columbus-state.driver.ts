import { jest } from '@jest/globals';
import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData, HostPageState } from '../../types/host-data';
import { readPageStateFromHostTabMock } from '../../testkit/mocks/host-tabs';
import type { readHostData as readHostDataType } from '../host-data/host-data';
import type { readDisabledArtifactVersionOverrides as readDisabledArtifactVersionOverridesType } from '../override-storage/override-storage';
import type { readHostDataCache as readHostDataCacheType } from '../host-data-cache/host-data-cache';

const readHostData = jest.fn<typeof readHostDataType>();
const readDisabledArtifactVersionOverrides =
  jest.fn<typeof readDisabledArtifactVersionOverridesType>();
const readHostDataCache = jest.fn<typeof readHostDataCacheType>();

jest.unstable_mockModule('../host-data/host-data', () => ({
  readHostData,
}));
jest.unstable_mockModule('../override-storage/override-storage', () => ({
  readDisabledArtifactVersionOverrides,
}));
jest.unstable_mockModule('../host-data-cache/host-data-cache', () => ({
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
  }

  readonly given = {
    hostDataCache: (cache: HostRead | undefined) => {
      readHostDataCache.mockResolvedValue(cache);

      return this;
    },
    pageState: (pageState: HostPageState) => {
      readPageStateFromHostTabMock.mockResolvedValue(pageState);

      return this;
    },
    pageStateFailure: (error: Error) => {
      readPageStateFromHostTabMock.mockRejectedValue(error);

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
    disabledArtifactVersionOverridesFailure: (error: Error) => {
      readDisabledArtifactVersionOverrides.mockRejectedValueOnce(error);

      return this;
    },
  };

  readonly get = {
    readHostData: () => readHostData,
    readHostDataCache: () => readHostDataCache,
    readPageStateFromHostTab: () => readPageStateFromHostTabMock,
    readDisabledArtifactVersionOverrides: () =>
      readDisabledArtifactVersionOverrides,
  };
}
