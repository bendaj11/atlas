import { afterEach, expect, test } from '@jest/globals';
import type {} from '../src/chrome.js';
import type { AtlasHostData } from '../src/contracts.js';
import { loadBrowserRuntimeOverrides } from '../../../packages/runtime/src/loader/runtime-discovery.js';
import {
  createOverrideDocument,
  readHostData,
} from '../src/popup/atlas-host.js';
import { createCustomManifest } from '../src/popup/manifest-utils.js';

const hostId = '060a7f62-1c95-402c-9993-55749faf36d9';
const hostData = createHostData(hostId, true);

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'chrome');
});

test('reads the active Atlas preview tab', async () => {
  installChromeMock({
    tabs: [{ id: 7, active: true, url: 'http://127.0.0.1:4300/orders' }],
    inspections: new Map([[7, hostData]]),
  });

  const result = await readHostData();

  expect(result.tabId).toBe(7);
});

test('caches inspected host data for the active tab', async () => {
  let inspectionCount = 0;
  installChromeMock({
    tabs: [{ id: 7, active: true, url: 'http://127.0.0.1:4300/orders' }],
    inspections: new Map([[7, hostData]]),
    onInspect: () => inspectionCount++,
  });

  await readHostData();
  const { readHostDataCache } = await import(
    '../src/popup/host-data-cache.js'
  );
  const cached = await readHostDataCache();

  expect(cached).toMatchObject({ tabId: 7, hostData: { config: { hostId } } });
  expect(inspectionCount).toBe(1);
});

test('finds the most recent host when Columbus itself is the active tab', async () => {
  installChromeMock({
    tabs: [
      {
        id: 9,
        active: true,
        lastAccessed: 30,
        url: 'chrome-extension://atlas/popup.html',
      },
      {
        id: 7,
        active: false,
        lastAccessed: 20,
        url: 'http://127.0.0.1:4300/orders',
      },
    ],
    inspections: new Map([[7, hostData]]),
  });

  const result = await readHostData();

  expect(result.tabId).toBe(7);
});

test('finds an open local preview when an app framework tab is active', async () => {
  installChromeMock({
    tabs: [
      { id: 8, active: true, lastAccessed: 20, url: 'http://localhost:4201/' },
      {
        id: 7,
        active: false,
        lastAccessed: 10,
        url: 'http://127.0.0.1:4300/orders',
      },
    ],
    inspections: new Map([[7, hostData]]),
  });

  const result = await readHostData();

  expect(result.tabId).toBe(7);
});

test('does not scan other tabs from a non-local page', async () => {
  installChromeMock({
    tabs: [
      { id: 8, active: true, url: 'https://example.com/' },
      { id: 7, active: false, url: 'http://127.0.0.1:4300/orders' },
    ],
    inspections: new Map([[7, hostData]]),
  });

  await expect(readHostData()).rejects.toThrow('No Atlas runtime');
});

test('rejects ambiguous local preview tabs', async () => {
  installChromeMock({
    tabs: [
      { id: 9, active: true, url: 'http://localhost:4201/' },
      { id: 8, active: false, url: 'http://localhost:4301/orders' },
      { id: 7, active: false, url: 'http://localhost:4300/orders' },
    ],
    inspections: new Map([
      [8, createHostData('399e1a5d-f83d-4248-96ed-e4211707ae1b', true)],
      [7, hostData],
    ]),
  });

  await expect(readHostData()).rejects.toThrow(
    'Multiple local Atlas previews are open',
  );
});

test('writes custom URL overrides in the runtime document format', async () => {
  const productionManifest = appManifest();
  const local = createCustomManifest({
    productionManifest,
    rawUrl: 'http://localhost:4513',
  });
  const documentValue = createOverrideDocument({
    hostData: {
      ...hostData,
      catalog: { ...hostData.catalog, apps: [productionManifest] },
    },
    overrides: new Map([['app:orders', local]]),
  });

  const overrides = await loadBrowserRuntimeOverrides({
    hostId,
    allowCustomOverrides: true,
    search: '',
    storage: {
      getItem: (key) =>
        key === 'atlas.runtime-overrides'
          ? JSON.stringify(documentValue)
          : null,
    },
    sessionStorage: { getItem: () => null },
  });

  expect(overrides).toHaveLength(1);
  expect(overrides[0]).toMatchObject({
    appId: 'orders',
    reason: 'local',
    manifest: { remoteEntryUrl: 'http://localhost:4513/remoteEntry.json' },
  });
});

interface ChromeMockOptions {
  tabs: MockTab[];
  inspections: Map<number, AtlasHostData>;
  onInspect?: () => void;
}

interface MockTab {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  url?: string;
}

function installChromeMock(options: ChromeMockOptions): void {
  const localStorage = new Map<string, unknown>();
  const sessionStorage = new Map<string, unknown>();
  const chromeMock = {
    tabs: {
      query: async () => options.tabs,
      reload: async () => undefined,
    },
    scripting: {
      executeScript: async ({ target }: { target: { tabId: number } }) => {
        options.onInspect?.();
        const result = options.inspections.get(target.tabId);
        if (!result) throw new Error('No Atlas runtime');
        return [{ result }];
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: localStorage.get(key) }),
        remove: async (key: string) => {
          localStorage.delete(key);
        },
        set: async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([key, value]) =>
            localStorage.set(key, value),
          );
        },
      },
      session: {
        get: async (key: string) => ({ [key]: sessionStorage.get(key) }),
        remove: async (key: string) => {
          sessionStorage.delete(key);
        },
        set: async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([key, value]) =>
            sessionStorage.set(key, value),
          );
        },
      },
    },
    action: {
      setBadgeBackgroundColor: async () => undefined,
      setBadgeTextColor: async () => undefined,
      setBadgeText: async () => undefined,
    },
  };
  Object.assign(globalThis, { chrome: chromeMock });
}

function createHostData(
  id: string,
  allowCustomOverrides: boolean,
): AtlasHostData {
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
      catalogUrl: `http://127.0.0.1:4400/hosts/${id}/catalog.json`,
      allowCustomOverrides,
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
