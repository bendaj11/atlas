import type { AtlasAppManifest, AtlasHostCatalog } from '@atlas/schema';
import { createRegistryWidgetResolver } from './widget-registry.js';

const WIDGET_ID = 'bc6ead7b-2264-4856-8287-c66cd8de7654';

export class WidgetRegistryDriver {
  private version?: string;
  private error?: unknown;

  readonly when = {
    resolvingSelectedProvider: async (): Promise<void> => {
      this.version = (await this.resolver()(WIDGET_ID)).ownerManifest.version;
    },
    resolvingMissingProvider: async (): Promise<void> => {
      try { await this.resolver()('missing-widget'); } catch (error) { this.error = error; }
    },
  };

  readonly get = {
    version: (): string | undefined => this.version,
    error: (): unknown => this.error,
  };

  private resolver() { return createRegistryWidgetResolver({ catalog: catalog() }); }
}

function catalog(): AtlasHostCatalog {
  return {
    schemaVersion: '1', revision: 'test', hostId: 'host', generatedAt: '2026-01-01T00:00:00.000Z', host: host(), apps: [], widgetProviders: [provider()],
  };
}
function host(): AtlasHostCatalog['host'] { return { schemaVersion: '1', kind: 'host', id: 'host', name: 'host', version: '1.0.0', buildId: 'build', channel: 'production', framework: 'react', remoteEntryUrl: 'https://registry.example/host.js', exposes: { entry: './entry' }, requiredLoaderApiVersion: '^1.0.0', createdAt: '2026-01-01T00:00:00.000Z' }; }
function provider(): AtlasAppManifest { return { schemaVersion: '1', kind: 'app', id: 'provider', name: 'provider', version: '2.3.0', buildId: 'build', channel: 'production', framework: 'react', remoteEntryUrl: 'https://registry.example/provider.js', exposes: { entry: './entry' }, requiredHostSdkVersion: '^1.0.0', supportedHosts: ['*'], placements: [], exportedWidgets: [{ schemaVersion: '1', id: WIDGET_ID, name: 'widget', ownerAppId: 'provider', framework: 'react', expose: './widget', contractVersion: '1', remoteEntryUrl: 'https://registry.example/provider.js' }], createdAt: '2026-01-01T00:00:00.000Z' }; }
