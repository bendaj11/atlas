import { jest } from '@jest/globals';
import type { AtlasOverrideDocument } from '../../types/override-document';
import type { writeHostDataCache as writeHostDataCacheType } from '../host-data-cache/host-data-cache';
import type { readPersistedOverrideDocument as readPersistedOverrideDocumentType } from '../override-storage/override-storage';
import type { InspectedHostTab } from '../host-tabs/host-tabs';
import { findAtlasHostTabMock } from '../../testkit/mocks/host-tabs';

const writeHostDataCache = jest.fn<typeof writeHostDataCacheType>();
const readPersistedOverrideDocument =
  jest.fn<typeof readPersistedOverrideDocumentType>();

jest.unstable_mockModule('../host-data-cache/host-data-cache', () => ({
  writeHostDataCache,
}));
jest.unstable_mockModule('../override-storage/override-storage', () => ({
  readPersistedOverrideDocument,
}));

export class HostDataDriver {
  constructor() {
    jest.clearAllMocks();
    writeHostDataCache.mockResolvedValue(undefined);
    readPersistedOverrideDocument.mockResolvedValue(undefined);
  }

  readonly given = {
    hostTab: (hostTab: InspectedHostTab) => {
      findAtlasHostTabMock.mockResolvedValue(hostTab);

      return this;
    },
    hostTabFailure: (error: Error) => {
      findAtlasHostTabMock.mockRejectedValue(error);

      return this;
    },
    persistedOverrideDocument: (document: AtlasOverrideDocument) => {
      readPersistedOverrideDocument.mockResolvedValue(document);

      return this;
    },
    cacheWriteFailure: (error: Error) => {
      writeHostDataCache.mockRejectedValue(error);

      return this;
    },
  };

  readonly get = {
    writeHostDataCache: () => writeHostDataCache,
  };
}
