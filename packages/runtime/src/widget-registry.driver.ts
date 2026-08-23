import { createHash } from 'node:crypto';
import type {
  AtlasAppArtifactManifest,
  AtlasHostCatalog,
  AtlasManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { createRegistryWidgetResolver } from './widget-registry.js';

const PROVIDER_ID = 'f1c201bc-44f8-4f7b-83f6-7ad90309b94c';
const WIDGET_ID = 'bc6ead7b-2264-4856-8287-c66cd8de7654';
const VERSION = '2.3.0';

export class WidgetRegistryDriver {
  private loadedVersion?: string;
  private error?: unknown;

  readonly when = {
    resolvingVersionOnlySelection: async (): Promise<void> => {
      const resolver = this.resolverFor(providerManifest());
      this.loadedVersion = (await resolver(WIDGET_ID)).ownerManifest.version;
    },
    resolvingMismatchedSelection: async (): Promise<void> => {
      const resolver = this.resolverFor(
        providerManifest({ id: '31c201bc-44f8-4f7b-83f6-7ad90309b94c' }),
      );
      try {
        await resolver(WIDGET_ID);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    loadedVersion: (): string | undefined => this.loadedVersion,
  };

  private resolverFor(manifest: AtlasAppArtifactManifest) {
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    const descriptor = {
      path: `apps/${PROVIDER_ID}/${VERSION}/manifest.json`,
      digest: digest(bytes),
      size: bytes.byteLength,
      mediaType: 'application/json' as const,
    };
    return createRegistryWidgetResolver({
      runtimeConfig: {
        schemaVersion: '1',
        hostId: 'host',
        environment: 'production',
        manifestUrl:
          'https://platform.example/environments/production/hosts/host/manifest.json',
        externalRegistries: [
          {
            registryUrl: 'https://widgets.example',
            environment: 'production',
          },
        ],
      },
      catalog: hostCatalog(),
      fetchJson: async () => registry(descriptor),
      fetchBytes: async () => bytes.buffer,
    });
  }
}

function registry(
  descriptor: AtlasStaticRegistry['apps'][string]['releases'][string],
): AtlasStaticRegistry {
  return {
    schemaVersion: '2',
    revision: `sha256:${'0'.repeat(64)}`,
    updatedAt: '2026-08-21T00:00:00.000Z',
    hosts: {},
    apps: {
      [PROVIDER_ID]: {
        id: PROVIDER_ID,
        name: 'shared-widgets',
        releases: { [VERSION]: descriptor },
        previews: {},
        latest: VERSION,
      },
    },
    deployments: {
      production: {
        hosts: {},
        apps: { [PROVIDER_ID]: { version: VERSION } },
        expectedHostRevisions: {},
      },
    },
  };
}

function hostCatalog(): AtlasHostCatalog {
  const requestingApp: AtlasManifest = {
    schemaVersion: '1',
    kind: 'app',
    id: 'requesting-app',
    name: 'requesting-app',
    version: '1.0.0',
    buildId: 'canonical',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://platform.example/requesting-app/entry.js',
    exposes: { entry: './entry' },
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: ['*'],
    placements: [],
    externalAppsDependencies: [PROVIDER_ID],
    createdAt: '2026-08-21T00:00:00.000Z',
  };
  return {
    schemaVersion: '1',
    revision: 'test-revision',
    hostId: 'host',
    generatedAt: '2026-08-21T00:00:00.000Z',
    host: {
      schemaVersion: '1',
      kind: 'host',
      id: 'host',
      name: 'host',
      version: '1.0.0',
      buildId: 'canonical',
      channel: 'production',
      framework: 'react',
      remoteEntryUrl: 'https://platform.example/host/entry.js',
      exposes: { entry: './entry' },
      requiredLoaderApiVersion: '^1.0.0',
      createdAt: '2026-08-21T00:00:00.000Z',
    },
    apps: [requestingApp],
  };
}

function providerManifest(
  overrides: Partial<AtlasAppArtifactManifest> = {},
): AtlasAppArtifactManifest {
  const id = overrides.id ?? PROVIDER_ID;
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id,
    name: 'shared-widgets',
    release: { version: VERSION },
    framework: 'react',
    entryPath: 'remoteEntry.json',
    exposes: { entry: './entry' },
    files: [
      {
        path: 'remoteEntry.json',
        digest: digest(new TextEncoder().encode('entry')),
        size: 5,
        mediaType: 'application/javascript',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'remote-entry',
      },
    ],
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: ['*'],
    placements: [],
    exportedWidgets: [
      {
        schemaVersion: '1',
        id: WIDGET_ID,
        name: 'Shared widget',
        ownerAppId: id,
        framework: 'react',
        expose: './widget',
        contractVersion: '1',
      },
    ],
    ...overrides,
  };
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
