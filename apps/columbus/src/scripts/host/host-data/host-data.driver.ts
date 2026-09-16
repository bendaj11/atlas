import { jest } from '@jest/globals';
import type {
  AtlasHostData as HostData,
  AtlasOverrideDocument as OverrideDocument,
} from '../../../types/contracts';
import { aHostData } from '../../../types/app.testkit';
import type { findAtlasHostTab as findAtlasHostTabType } from '../host-tabs/host-tabs';
import type { writeHostDataCache as writeHostDataCacheType } from '../host-data-cache';
import type { readPersistedOverrideDocument as readPersistedOverrideDocumentType } from '../../overrides/override-storage/override-storage';

const findAtlasHostTab = jest.fn<typeof findAtlasHostTabType>();
const writeHostDataCache = jest.fn<typeof writeHostDataCacheType>();
const readPersistedOverrideDocument =
  jest.fn<typeof readPersistedOverrideDocumentType>();

jest.unstable_mockModule('../host-tabs/host-tabs', () => ({
  findAtlasHostTab,
}));
jest.unstable_mockModule('../host-data-cache', () => ({ writeHostDataCache }));
jest.unstable_mockModule(
  '../../overrides/override-storage/override-storage',
  () => ({
    readPersistedOverrideDocument,
  }),
);

const { readHostData } = await import('./host-data');

export class HostDataDriver {
  private hostData: HostData = aHostData();
  private result: Awaited<ReturnType<typeof readHostData>> | undefined;
  private error: unknown;

  constructor() {
    jest.clearAllMocks();
    this.given.hostData(this.hostData);
    writeHostDataCache.mockResolvedValue(undefined);
    readPersistedOverrideDocument.mockResolvedValue(undefined);
  }

  readonly given = {
    hostData: (hostData: HostData): this => {
      this.hostData = hostData;
      findAtlasHostTab.mockResolvedValue({
        tab: { id: 7, url: 'https://shop.example/' },
        hostData,
      });

      return this;
    },
    persistedOverrides: (document: OverrideDocument): this => {
      readPersistedOverrideDocument.mockResolvedValue(document);

      return this;
    },
    cacheWriteFailure: (): this => {
      writeHostDataCache.mockRejectedValue(new Error('Quota exceeded.'));

      return this;
    },
    noHostTab: (reason: string): this => {
      findAtlasHostTab.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    hostDataRead: async (): Promise<void> => {
      try {
        this.result = await readHostData();
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: () => this.result,
    error: (): unknown => this.error,
    cachedSnapshot: () => writeHostDataCache.mock.calls[0]?.[0],
  };
}
