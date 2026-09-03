import { createHash } from 'node:crypto';
import type {
  AtlasExtensionManifest,
  AtlasExtensionWidgetManifest,
} from '../../../types/contracts.js';
import { inspectAtlasHost, loadArtifactVersion } from './inspect-atlas-host.js';

interface PageOptions {
  app?: AtlasExtensionManifest;
  appVersions?: AtlasExtensionManifest[];
  deploymentApp?: AtlasExtensionManifest;
  catalogHostId?: string;
  registryUrl?: string;
  registryUnavailable?: boolean;
  stalePreview?: boolean;
  visibleAppIds?: string[];
  runtimeError?: { appId?: string; message: string };
  stored?: Record<string, unknown>;
  runtimeEnvironment?: string;
  runtimeSnapshot?: boolean;
  useDevelopmentCatalog?: boolean;
  deploymentEnvironment?: string;
  onManifestRequest?: (cache: RequestCache | undefined) => void;
  onDeploymentRequest?: () => void;
  onRegistryRequest?: () => void;
}

const documentKey = 'atlas.runtime-overrides';
const hostId = 'test-host';

export class InspectAtlasHostDriver {
  private options: PageOptions = {};
  private result: Awaited<ReturnType<typeof inspectAtlasHost>> | undefined;
  private error: unknown;
  private expectedWidget: AtlasExtensionWidgetManifest | undefined;
  private manifestRequests = 0;
  private deploymentRequests = 0;
  private registryRequests = 0;
  private manifestRequestCaches: Array<RequestCache | undefined> = [];
  private loadedManifest: AtlasExtensionManifest | undefined;

  readonly given = {
    localCatalogWithEmptyStoredSelection: (): this => {
      this.options = {
        app: manifest({
          channel: 'local',
          buildId: 'local',
          remoteEntryUrl: 'http://localhost:4510/remoteEntry.json',
        }),
        stored: {
          schemaVersion: '1',
          hostId,
          overrides: [],
          generatedAt: '2026-07-20T00:00:00.000Z',
        },
      };
      return this;
    },
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
    catalogWithPublishedVersions: (): this => {
      this.options = {
        app: manifest({ channel: 'production' }),
        appVersions: [
          manifest({ channel: 'production' }),
          manifest({
            channel: 'pr',
            buildId: 'pr-42',
            prNumber: 42,
            gitBranch: 'feature/preview-overrides',
            gitSha: 'abcdef123456',
            gitCommitTitle: 'Fix preview overrides',
          }),
        ],
        registryUrl: 'http://localhost:4400',
      };
      return this;
    },
    catalogWithStalePublishedPreview: (): this => {
      this.given.catalogWithPublishedVersions();
      this.options.stalePreview = true;
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
      this.options.registryUrl = 'https://registry.example';
      return this;
    },
    unavailableRegistry: (): this => {
      this.options.registryUnavailable = true;
      return this;
    },
    runtimeError: (message: string, appId?: string): this => {
      this.options.runtimeError = appId ? { message, appId } : { message };
      return this;
    },
    visibleApps: (...appIds: string[]): this => {
      this.options.visibleAppIds = appIds;
      return this;
    },
    publishedAppWithExportedWidget: (
      metadata: Record<string, string | number | boolean>,
    ): this => {
      this.expectedWidget = {
        schemaVersion: '1',
        id: 'order-summary',
        name: 'Order summary',
        ownerAppId: 'orders',
        framework: 'react',
        remoteEntryUrl:
          'https://registry.example/apps/orders/1.0.0/remoteEntry.json',
        expose: './widgets/order-summary',
        contractVersion: '1',
        metadata,
      };
      const app = manifest({ exportedWidgets: [this.expectedWidget] });
      this.options = {
        app,
        appVersions: [app],
        registryUrl: 'https://registry.example',
      };
      return this;
    },
    publishedAppWithRuntimeFields: (): this => {
      const app = manifest({
        isolation: 'shadow-dom',
        metadata: { owner: 'checkout' },
      });
      this.options = {
        app,
        appVersions: [app],
        registryUrl: 'https://registry.example',
      };
      return this;
    },
    hostDeploymentEnvironment: (environment: string): this => {
      this.options.useDevelopmentCatalog = false;
      this.options.deploymentEnvironment = environment;
      return this;
    },
    runtimeWithoutEnvironment: (): this => {
      this.options.runtimeEnvironment = '';
      return this;
    },
    developmentRuntimeSnapshot: (): this => {
      this.options = {
        app: manifest({
          channel: 'local',
          buildId: 'local',
          remoteEntryUrl: 'http://localhost:4510/remoteEntry.json',
        }),
        runtimeEnvironment: 'development',
        registryUrl: 'http://localhost:4400',
        runtimeSnapshot: true,
      };
      return this;
    },
    developmentSessionCatalog: (): this => {
      this.options = {
        app: manifest({
          channel: 'local',
          buildId: 'local',
          remoteEntryUrl: 'http://localhost:4510/remoteEntry.json',
        }),
        runtimeEnvironment: 'development',
        registryUrl: 'http://localhost:4400',
      };
      return this;
    },
    runtimeSnapshotWithProductionOverride: (
      deployedVersion: string,
      overrideVersion: string,
    ): this => {
      const deploymentApp = manifest({ version: deployedVersion });
      const app = manifest({ version: overrideVersion });
      this.options = {
        app,
        appVersions: [deploymentApp, app],
        deploymentApp,
        runtimeSnapshot: true,
      };
      return this;
    },
  };

  readonly when = {
    hostInspected: async (): Promise<this> => {
      installPage({
        ...this.options,
        onManifestRequest: (cache) => {
          this.manifestRequests++;
          this.manifestRequestCaches.push(cache);
        },
        onDeploymentRequest: () => this.deploymentRequests++,
        onRegistryRequest: () => this.registryRequests++,
      });
      try {
        this.result = await inspectAtlasHost(documentKey);
      } catch (error) {
        this.error = error;
      }
      return this;
    },
    publishedAppVersionLoaded: async (): Promise<this> => {
      this.loadedManifest = await loadArtifactVersion(
        'app:orders',
        'production:1.0.0:canonical',
      );
      return this;
    },
    publishedPreviewLoaded: async (): Promise<this> => {
      this.loadedManifest = await loadArtifactVersion(
        'app:orders',
        'pr:42:abcdef123456',
      );
      return this;
    },
  };

  readonly get = {
    result: () => {
      if (!this.result) throw new Error('Host inspection did not succeed.');
      return this.result;
    },
    error: (): unknown => this.error,
    visibleAppIds: (): string[] => this.result?.visibleAppIds ?? [],
    appVersionChannels: (): string[] =>
      this.result?.versions['app:orders']?.map(({ channel }) => channel) ?? [],
    catalogAppVersion: (): string | undefined =>
      this.result?.catalog.apps[0]?.version,
    previewVersion: (): AtlasExtensionManifest | undefined =>
      this.result?.versions['app:orders']?.find(
        ({ channel }) => channel === 'pr',
      ),
    loadedManifestVersion: (): string | undefined =>
      this.loadedManifest?.version,
    exportedWidget: (): AtlasExtensionWidgetManifest | undefined =>
      this.loadedManifest?.exportedWidgets?.[0],
    expectedWidget: (): AtlasExtensionWidgetManifest => {
      if (!this.expectedWidget)
        throw new Error('Expected widget was not configured.');
      return this.expectedWidget;
    },
    hydratedRuntimeFields: () => {
      const manifest = this.loadedManifest;
      return {
        createdAt: manifest?.createdAt,
        isolation: manifest?.isolation,
        metadata: manifest?.metadata,
      };
    },
    manifestRequestCount: (): number => this.manifestRequests,
    developmentInspection: () => ({
      catalogAppVersion: this.result?.catalog.apps[0]?.version,
      deploymentRequests: this.deploymentRequests,
      registryRequests: this.registryRequests,
    }),
    registryFailure: () => ({
      catalogAppVersion: this.result?.catalog.apps[0]?.version,
      versionErrors: this.result?.versionErrors,
    }),
    versionErrors: (): string[] => this.result?.versionErrors ?? [],
    manifestRequestCache: (): RequestCache | undefined =>
      this.manifestRequestCaches[0],
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
  const deploymentApp = options.deploymentApp ?? app;
  const fixtures = registryFixtures(host, options.appVersions ?? [app]);
  if (options.stalePreview) addStalePreview(fixtures.registry, app.id);
  const localValues = new Map<string, string>();
  if (options.stored) {
    localValues.set(documentKey, JSON.stringify(options.stored));
  }

  Object.assign(globalThis, {
    document: {
      getElementById: (id: string) =>
        id === 'atlas-runtime-snapshot' && options.runtimeSnapshot
          ? {
              textContent: JSON.stringify({
                schemaVersion: '1',
                runtime: {
                  schemaVersion: 'v1',
                  hostId,
                  environment: 'development',
                  artifactRegistryUrl:
                    options.registryUrl ?? 'https://registry.example',
                },
                catalog: {
                  schemaVersion: '1',
                  hostId: catalogHostId,
                  revision: 'test',
                  generatedAt: '2026-07-20T00:00:00.000Z',
                  host,
                  apps: [app],
                },
              }),
            }
          : null,
      querySelectorAll: (selector: string) => {
        if (selector === '[data-atlas-app-id]') {
          return (options.visibleAppIds ?? []).map((appId) => ({
            getAttribute: (name: string) =>
              name === 'data-atlas-app-id' ? appId : null,
          }));
        }
        if (selector !== '[data-atlas-state="error"]' || !options.runtimeError)
          return [];
        return [
          {
            textContent: options.runtimeError.message,
            getAttribute: (name: string) =>
              name === 'data-atlas-app-id'
                ? (options.runtimeError?.appId ?? null)
                : null,
          },
        ];
      },
    },
    location: {
      href: 'https://host.example/dashboard',
      hostname: 'host.example',
    },
    localStorage: storage(localValues),
    sessionStorage: storage(new Map()),
    fetch: async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'https://host.example');
      if (url.pathname === '/atlas.runtime.json') {
        const runtime = {
          schemaVersion: 'v1',
          hostId,
          ...(options.runtimeEnvironment === ''
            ? {}
            : { environment: options.runtimeEnvironment ?? 'production' }),
          artifactRegistryUrl:
            options.registryUrl ?? 'https://registry.example',
          ...(options.runtimeEnvironment === 'development'
            ? {
                developmentSessionUrl:
                  'http://localhost:4400/atlas.dev-session.json',
              }
            : {}),
        };
        return jsonResponse(runtime);
      }
      if (url.pathname.endsWith('/atlas.dev-session.json')) {
        return jsonResponse({
          catalog: {
            schemaVersion: '1',
            hostId: catalogHostId,
            revision: 'test',
            host,
            apps: [app],
          },
        });
      }
      if (url.pathname.endsWith('/registry.json')) {
        options.onRegistryRequest?.();
        if (options.registryUnavailable)
          return new Response('Not found', { status: 404 });
        return jsonResponse(fixtures.registry);
      }
      if (url.pathname.startsWith('/environments/'))
        options.onDeploymentRequest?.();
      if (
        url.pathname ===
        `/environments/production/hosts/${hostId}/manifest.json`
      ) {
        return jsonResponse({
          schemaVersion: 'v1',
          kind: 'host-deployment',
          hostId,
          environment: options.deploymentEnvironment ?? 'production',
          deploymentRevision: 'fixture',
          host: descriptor(fixtures.registry, 'hosts', host.id, host.version),
          apps: [deploymentApp]
            .filter(({ channel }) => channel !== 'local')
            .map((manifest) =>
              descriptor(
                fixtures.registry,
                'apps',
                manifest.id,
                manifest.version,
              ),
            ),
        });
      }
      const bytes = fixtures.manifests.get(url.pathname.replace(/^\//u, ''));
      if (bytes) options.onManifestRequest?.(init?.cache);
      return bytes
        ? new Response(bytes.buffer as ArrayBuffer, { status: 200 })
        : new Response('Not found', { status: 404 });
    },
  });
}

function registryFixtures(
  host: AtlasExtensionManifest,
  apps: AtlasExtensionManifest[],
): {
  registry: RegistryFixture;
  manifests: Map<string, Uint8Array>;
} {
  const manifests = new Map<string, Uint8Array>();
  const hostRecord = artifactRecord(host, manifests);
  const appRecords = new Map<string, ReturnType<typeof emptyArtifactRecord>>();
  for (const app of apps.filter(({ channel }) => channel !== 'local')) {
    const current = appRecords.get(app.id) ?? emptyArtifactRecord(app);
    const next = artifactRecord(app, manifests);
    Object.assign(current.releases, next.releases);
    Object.assign(current.previews, next.previews);
    current.latest = next.latest ?? current.latest;
    appRecords.set(app.id, current);
  }
  return {
    manifests,
    registry: {
      schemaVersion: '2',
      revision: `sha256:${'0'.repeat(64)}`,
      updatedAt: '2026-07-20T00:00:00.000Z',
      hosts: { [host.id]: hostRecord },
      apps: Object.fromEntries(appRecords),
    },
  };
}

function addStalePreview(registry: RegistryFixture, appId: string): void {
  registry.apps[appId]!.previews['43'] = {
    path: `apps/${appId}/previews/43/missing-manifest.json`,
    digest: `sha256:${'0'.repeat(64)}`,
    size: 1,
    mediaType: 'application/json',
  };
}

interface RegistryArtifactFixture {
  id: string;
  name: string;
  releases: Record<string, DescriptorFixture>;
  previews: Record<string, DescriptorFixture>;
  latest?: string;
}

interface RegistryFixture {
  schemaVersion: '2';
  revision: string;
  updatedAt: string;
  hosts: Record<string, RegistryArtifactFixture>;
  apps: Record<string, RegistryArtifactFixture>;
}

function emptyArtifactRecord(
  manifest: AtlasExtensionManifest,
): RegistryArtifactFixture {
  return {
    id: manifest.id,
    name: manifest.name,
    releases: {} as Record<string, DescriptorFixture>,
    previews: {} as Record<string, DescriptorFixture>,
    latest: undefined as string | undefined,
  };
}

interface DescriptorFixture {
  path: string;
  digest: `sha256:${string}`;
  size: number;
  mediaType: 'application/json';
}

function descriptor(
  registry: Pick<RegistryFixture, 'apps' | 'hosts'>,
  collection: 'apps' | 'hosts',
  id: string,
  version: string,
): DescriptorFixture {
  const artifacts = registry[collection];
  return artifacts[id]!.releases[version]!;
}

function artifactRecord(
  manifest: AtlasExtensionManifest,
  manifests: Map<string, Uint8Array>,
) {
  const record = emptyArtifactRecord(manifest);
  const preview = manifest.channel === 'pr';
  const identity = preview
    ? `previews/${manifest.prNumber ?? 1}/fixture`
    : manifest.version;
  const collection = manifest.kind === 'host' ? 'hosts' : 'apps';
  const path = `${collection}/${manifest.id}/${identity}/manifest.json`;
  const artifact = {
    schemaVersion: '2',
    kind: manifest.kind === 'host' ? 'host-artifact' : 'app-artifact',
    id: manifest.id,
    name: manifest.name,
    ...(preview
      ? {
          preview: {
            number: manifest.prNumber ?? 1,
            gitSha: manifest.gitSha ?? 'abc123',
            ...(manifest.gitBranch ? { gitBranch: manifest.gitBranch } : {}),
            ...(manifest.gitCommitTitle
              ? { gitCommitTitle: manifest.gitCommitTitle }
              : {}),
          },
        }
      : { release: { version: manifest.version } }),
    framework: manifest.framework,
    entryPath: 'remoteEntry.json',
    exposes: manifest.exposes ?? { entry: './entry' },
    files: [
      {
        path: 'remoteEntry.json',
        digest: `sha256:${'a'.repeat(64)}`,
        size: 1,
        mediaType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'remote-entry',
      },
    ],
    ...(manifest.kind === 'host'
      ? { requiredLoaderApiVersion: '^1.0.0' }
      : {
          requiredHostSdkVersion: '^0.1.0',
          supportedHosts: manifest.supportedHosts ?? [hostId],
          placements: manifest.placements ?? [],
          ...(manifest.isolation ? { isolation: manifest.isolation } : {}),
          ...(manifest.metadata ? { metadata: manifest.metadata } : {}),
          ...(manifest.exportedWidgets?.length
            ? {
                exportedWidgets: manifest.exportedWidgets.map((widget) => ({
                  schemaVersion: widget.schemaVersion,
                  id: widget.id,
                  name: widget.name,
                  ownerAppId: widget.ownerAppId,
                  framework: widget.framework,
                  expose: widget.expose,
                  contractVersion: widget.contractVersion,
                  ...(widget.metadata ? { metadata: widget.metadata } : {}),
                })),
              }
            : {}),
        }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(artifact));
  manifests.set(path, bytes);
  const descriptor: DescriptorFixture = {
    path,
    digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    size: bytes.byteLength,
    mediaType: 'application/json',
  };
  if (preview) record.previews[String(manifest.prNumber ?? 1)] = descriptor;
  else {
    record.releases[manifest.version] = descriptor;
    record.latest = manifest.version;
  }
  return record;
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
