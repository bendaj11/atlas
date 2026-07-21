import { afterEach, expect, test } from '@jest/globals';
import type { AtlasExtensionManifest } from '../src/contracts.js';
import { inspectAtlasHost } from '../src/popup/inspect-atlas-host.js';

const documentKey = 'atlas.runtime-overrides';
const hostId = 'test-host';

afterEach(() => {
  for (const key of [
    'document',
    'fetch',
    'localStorage',
    'location',
    'sessionStorage',
  ]) {
    Reflect.deleteProperty(globalThis, key);
  }
});

test('stored PR selection wins over an automatically discovered local app', async () => {
  const productionManifest = manifest({ channel: 'production' });
  const localManifest = manifest({
    channel: 'local',
    version: '0.0.0-local',
    buildId: 'local',
    remoteEntryUrl: 'http://localhost:4510/remoteEntry.json',
  });
  const pullRequestManifest = manifest({
    channel: 'pr',
    version: '1.1.0-pr.42',
    buildId: 'pr-42',
    prNumber: 42,
  });
  installPage({
    app: localManifest,
    appVersions: [productionManifest, pullRequestManifest, localManifest],
    stored: {
      schemaVersion: '1',
      hostId,
      overrides: [
        { appId: 'orders', manifest: pullRequestManifest, reason: 'pr' },
      ],
      generatedAt: '2026-07-20T00:00:00.000Z',
    },
  });

  const result = await inspectAtlasHost(documentKey);

  expect(result.overrides?.overrides[0]?.manifest).toMatchObject({
    channel: 'pr',
    buildId: 'pr-42',
  });
});

test('catalog host identity must match runtime configuration', async () => {
  installPage({ catalogHostId: 'other-host' });

  await expect(inspectAtlasHost(documentKey)).rejects.toThrow(
    'Atlas catalog targets host other-host',
  );
});

test('version index for another artifact is rejected without hiding catalog', async () => {
  installPage({
    appVersions: [manifest({ id: 'other-app', name: 'Other App' })],
  });

  const result = await inspectAtlasHost(documentKey);

  expect(result.catalog.apps).toHaveLength(1);
  expect(result.versionErrors).toEqual([
    expect.stringContaining('returned versions for another artifact'),
  ]);
});

test('runtime errors retain their artifact identity', async () => {
  installPage({
    runtimeError: {
      appId: 'orders',
      message: 'Unable to load Orders.',
    },
  });

  const result = await inspectAtlasHost(documentKey);

  expect(result.runtimeErrors).toEqual([
    {
      artifactId: 'app:orders',
      message: 'Unable to load Orders.',
    },
  ]);
});

test('runtime errors use the catalog name when legacy DOM omits artifact identity', async () => {
  installPage({
    runtimeError: {
      message: 'Unable to load Orders. Retry',
    },
  });

  const result = await inspectAtlasHost(documentKey);

  expect(result.runtimeErrors).toEqual([
    {
      artifactId: 'app:orders',
      message: 'Unable to load Orders. Retry',
    },
  ]);
});

interface PageOptions {
  app?: AtlasExtensionManifest;
  appVersions?: AtlasExtensionManifest[];
  catalogHostId?: string;
  runtimeError?: { appId?: string; message: string };
  stored?: Record<string, unknown>;
}

function installPage(options: PageOptions = {}): void {
  const catalogHostId = options.catalogHostId ?? hostId;
  const host = manifest({
    kind: 'host',
    id: catalogHostId,
    name: 'Host',
  });
  const app = options.app ?? manifest({});
  const localValues = new Map<string, string>();
  if (options.stored)
    localValues.set(documentKey, JSON.stringify(options.stored));

  Object.assign(globalThis, {
    document: {
      querySelectorAll: () =>
        options.runtimeError
          ? [
              {
                textContent: options.runtimeError.message,
                getAttribute: (name: string) =>
                  name === 'data-atlas-app-id'
                    ? (options.runtimeError?.appId ?? null)
                    : null,
              },
            ]
          : [],
    },
    location: {
      href: 'https://host.example/dashboard',
      hostname: 'host.example',
    },
    localStorage: storage(localValues),
    sessionStorage: storage(new Map()),
    fetch: async (input: string | URL) => {
      const url = new URL(String(input), 'https://host.example');
      if (url.pathname === '/atlas.runtime.json') {
        return jsonResponse({
          schemaVersion: '1',
          hostId,
          catalogUrl: `https://registry.example/hosts/${hostId}/catalog.json`,
          allowCustomOverrides: true,
        });
      }
      if (url.pathname.endsWith('/catalog.json')) {
        return jsonResponse({
          schemaVersion: '1',
          hostId: catalogHostId,
          revision: 'test',
          host,
          apps: [app],
        });
      }
      if (url.pathname.includes('/hosts/'))
        return jsonResponse({ manifests: [host] });
      return jsonResponse({ manifests: options.appVersions ?? [app] });
    },
  });
}

function storage(values: Map<string, string>): Storage {
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 });
}

function manifest(
  overrides: Partial<AtlasExtensionManifest>,
): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'production',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/remoteEntry.json',
    supportedHosts: [hostId],
    placements: [],
    ...overrides,
  };
}
