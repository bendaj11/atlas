import type {} from '../../../types/chrome.js';
import type { AtlasHostData } from '../../../types/contracts.js';
import { loadBrowserRuntimeOverrides } from '../../../../../../packages/runtime/src/loader/runtime-discovery.js';
import {
  createOverrideDocument,
  readHostData,
  writeOverrides,
} from './atlas-host.js';
import { readHostDataCache } from '../host-data-cache.js';
import { createCustomManifest } from '../../manifests/manifest-utils/manifest-utils.js';

interface MockTab {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  url?: string;
}

const hostId = '060a7f62-1c95-402c-9993-55749faf36d9';

export class AtlasHostDriver {
  private tabs: MockTab[] = [];
  private inspections = new Map<number, AtlasHostData>();
  private inspectionCount = 0;
  private result: Awaited<ReturnType<typeof readHostData>> | undefined;
  private error: unknown;

  readonly given = {
    tabs: (...tabs: MockTab[]): this => {
      this.tabs = tabs;
      return this;
    },
    inspectedHost: (tabId: number, id = hostId): this => {
      this.inspections.set(tabId, createHostData(id));
      return this;
    },
  };

  readonly when = {
    hostDataRead: async (): Promise<this> => {
      this.installChrome();
      try {
        this.result = await readHostData();
      } catch (error) {
        this.error = error;
      }
      return this;
    },
  };

  readonly get = {
    tabId: (): number | undefined => this.result?.tabId,
    error: (): unknown => this.error,
    cachedHostData: () => readHostDataCache(),
    inspectionCount: (): number => this.inspectionCount,
    runtimeOverrides: async () => {
      const productionManifest = appManifest();
      const local = createCustomManifest({
        productionManifest,
        rawUrl: 'http://localhost:4513',
      });
      const documentValue = createOverrideDocument({
        hostData: {
          ...createHostData(hostId),
          catalog: {
            ...createHostData(hostId).catalog,
            apps: [productionManifest],
          },
        },
        overrides: new Map([['app:orders', local]]),
      });
      return loadBrowserRuntimeOverrides({
        hostId,
        search: '',
        sessionStorage: {
          getItem: (key: string) =>
            key === 'atlas.runtime-overrides'
              ? JSON.stringify(documentValue)
              : null,
        },
      });
    },
    localSuppressionDocument: async (): Promise<unknown> => {
      const localValues = new Map<string, string>();
      const sessionValues = new Map<string, string>();
      Object.assign(globalThis, {
        localStorage: pageStorageArea(localValues),
        sessionStorage: pageStorageArea(sessionValues),
        location: { href: 'http://localhost:4300/dashboard' },
        history: {
          state: undefined,
          replaceState: () => undefined,
        },
        chrome: {
          scripting: {
            executeScript: async ({
              func,
              args,
            }: {
              func: (...values: string[]) => void;
              args: string[];
            }) => {
              func(...args);
              return [{ result: undefined }];
            },
          },
          storage: { local: storageArea(new Map()) },
        },
      });
      try {
        const hostData = createHostData(hostId);
        await writeOverrides({
          tabId: 7,
          hostData,
          documentValue: {
            schemaVersion: '1',
            hostId,
            overrides: [],
            generatedAt: '2026-07-26T00:00:00.000Z',
          },
          scope: 'all',
          disabledAppIds: ['orders'],
        });
        const stored = localValues.get('atlas.runtime-overrides');
        return stored ? JSON.parse(stored) : undefined;
      } finally {
        Reflect.deleteProperty(globalThis, 'localStorage');
        Reflect.deleteProperty(globalThis, 'sessionStorage');
        Reflect.deleteProperty(globalThis, 'location');
        Reflect.deleteProperty(globalThis, 'history');
        Reflect.deleteProperty(globalThis, 'chrome');
      }
    },
  };

  dispose(): void {
    Reflect.deleteProperty(globalThis, 'chrome');
  }

  private installChrome(): void {
    const localStorage = new Map<string, unknown>();
    const sessionStorage = new Map<string, unknown>();
    Object.assign(globalThis, {
      chrome: {
        tabs: {
          query: async () => this.tabs,
          reload: async () => undefined,
          sendMessage: async (tabId: number) => {
            this.inspectionCount += 1;
            const hostData = this.inspections.get(tabId);
            if (!hostData) throw new Error('No Atlas runtime');
            return { ok: true, hostData };
          },
        },
        storage: {
          local: storageArea(localStorage),
          session: storageArea(sessionStorage),
        },
        action: {
          setBadgeBackgroundColor: async () => undefined,
          setBadgeTextColor: async () => undefined,
          setBadgeText: async () => undefined,
        },
      },
    });
  }
}

function storageArea(values: Map<string, unknown>) {
  return {
    get: async (key: string) => ({ [key]: values.get(key) }),
    remove: async (key: string) => values.delete(key),
    set: async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => values.set(key, value));
    },
  };
}

function pageStorageArea(values: Map<string, string>): Storage {
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createHostData(id: string): AtlasHostData {
  const host = {
    schemaVersion: '1' as const,
    kind: 'host' as const,
    id,
    name: 'Test Host',
    version: '1.0.0',
    buildId: 'host-build',
    channel: 'production' as const,
    framework: 'react' as const,
    remoteEntryUrl: 'http://127.0.0.1:4200/remoteEntry.json',
  };
  return {
    config: {
      schemaVersion: '1',
      hostId: id,
      environment: 'production',
      manifestUrl: `http://127.0.0.1:4400/hosts/${id}/manifest.json`,
    },
    pageUrl: 'http://127.0.0.1:4300/',
    catalog: {
      schemaVersion: '1',
      hostId: id,
      revision: 'test',
      host,
      apps: [],
    },
    versions: { [`host:${id}`]: [host] },
    overrides: undefined,
    overrideScope: undefined,
    runtimeErrors: [],
    versionErrors: [],
  };
}

function appManifest(): AtlasHostData['catalog']['apps'][number] {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'orders-build',
    channel: 'production',
    createdAt: '2026-07-20T00:00:00.000Z',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/orders/remoteEntry.json',
    exposes: { entry: './entry' },
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: [hostId],
    placements: [],
  };
}
