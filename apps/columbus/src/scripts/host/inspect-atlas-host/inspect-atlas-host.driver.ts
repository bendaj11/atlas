import type { AtlasExtensionManifest } from '../../../types/contracts.js';
import { inspectAtlasHost } from './inspect-atlas-host.js';

interface PageOptions {
  app?: AtlasExtensionManifest;
  appVersions?: AtlasExtensionManifest[];
  catalogHostId?: string;
  runtimeError?: { appId?: string; message: string };
  stored?: Record<string, unknown>;
}

const documentKey = 'atlas.runtime-overrides';
const hostId = 'test-host';

export class InspectAtlasHostDriver {
  private options: PageOptions = {};
  private result: Awaited<ReturnType<typeof inspectAtlasHost>> | undefined;
  private error: unknown;

  readonly given = {
    localAppWithStoredPr: (): this => {
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
      this.options = {
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
      };
      return this;
    },
    catalogHostId: (catalogHostId: string): this => {
      this.options.catalogHostId = catalogHostId;
      return this;
    },
    versionsForOtherApp: (): this => {
      this.options.appVersions = [
        manifest({ id: 'other-app', name: 'Other App' }),
      ];
      return this;
    },
    runtimeError: (message: string, appId?: string): this => {
      this.options.runtimeError = appId ? { message, appId } : { message };
      return this;
    },
  };

  readonly when = {
    hostInspected: async (): Promise<this> => {
      installPage(this.options);
      try {
        this.result = await inspectAtlasHost(documentKey);
      } catch (error) {
        this.error = error;
      }
      return this;
    },
  };

  readonly get = {
    result: () => {
      if (!this.result) throw new Error('Host inspection did not succeed.');
      return this.result;
    },
    error: (): unknown => this.error,
  };

  dispose(): void {
    for (const key of [
      'document',
      'fetch',
      'localStorage',
      'location',
      'sessionStorage',
    ]) {
      Reflect.deleteProperty(globalThis, key);
    }
  }
}

function installPage(options: PageOptions): void {
  const catalogHostId = options.catalogHostId ?? hostId;
  const host = manifest({ kind: 'host', id: catalogHostId, name: 'Host' });
  const app = options.app ?? manifest({});
  const localValues = new Map<string, string>();
  if (options.stored) {
    localValues.set(documentKey, JSON.stringify(options.stored));
  }

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
      if (url.pathname.includes('/hosts/')) {
        return jsonResponse({ manifests: [host] });
      }
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
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
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
