import type { AtlasHostData as HostData } from '../../types/contracts';
import { aHostData } from '../../types/app.testkit';
import {
  type FakeChrome,
  type FakeTab,
  installFakeChrome,
} from '../chrome.testkit';
import {
  clearHostDataCache,
  readHostDataCache,
  writeHostDataCache,
} from './host-data-cache';

const CACHE_KEY = 'atlas.host-data-cache';

export class HostDataCacheDriver {
  private readonly chrome: FakeChrome = installFakeChrome();
  private readonly hostData: HostData = aHostData();
  private result: Awaited<ReturnType<typeof readHostDataCache>>;

  readonly given = {
    tabs: (tabs: FakeTab[]): this => {
      this.chrome.tabs = tabs;

      return this;
    },
    cachedSnapshot: (tabId: number, tabUrl: string): this => {
      this.chrome.sessionStorage.set(CACHE_KEY, {
        hostData: this.hostData,
        tabId,
        tabUrl,
      });

      return this;
    },
    storedValue: (value: unknown): this => {
      this.chrome.sessionStorage.set(CACHE_KEY, value);

      return this;
    },
  };

  readonly when = {
    cacheRead: async (): Promise<this> => {
      this.result = await readHostDataCache();

      return this;
    },
    cacheWritten: async (tabId: number, tabUrl: string): Promise<this> => {
      await writeHostDataCache({ hostData: this.hostData, tabId, tabUrl });

      return this;
    },
    cacheCleared: async (tabId?: number): Promise<this> => {
      await clearHostDataCache(tabId);

      return this;
    },
  };

  readonly get = {
    result: () => this.result,
    hostData: (): HostData => this.hostData,
    storedSnapshot: (): unknown => this.chrome.sessionStorage.get(CACHE_KEY),
  };
}
