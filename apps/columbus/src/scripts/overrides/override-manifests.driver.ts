import { faker } from '@faker-js/faker';
import type {
  AtlasExtensionManifest as Manifest,
  AtlasHostData as HostData,
} from '../../types/contracts';
import {
  extractActiveOverrideManifests,
  includeOverrideAppsInCatalog,
} from './override-manifests';

export class OverrideManifestsDriver {
  private readonly hostId = faker.string.uuid();
  private readonly localApp = this.aManifest('app', faker.string.uuid());
  private readonly hostData: HostData = {
    config: {
      schemaVersion: 'v1',
      hostId: this.hostId,
      environment: 'production',
      artifactRegistryUrl: faker.internet.url(),
    },
    pageUrl: faker.internet.url(),
    catalog: {
      schemaVersion: '1',
      hostId: this.hostId,
      revision: faker.string.uuid(),
      host: this.aManifest('host', this.hostId),
      apps: [],
    },
    overrides: {
      schemaVersion: '1',
      hostId: this.hostId,
      overrides: [
        { appId: this.localApp.id, manifest: this.localApp, reason: 'local' },
      ],
      generatedAt: faker.date.recent().toISOString(),
    },
    overrideScope: 'tab',
    versions: {},
    runtimeErrors: [],
    versionErrors: [],
  };
  private result: HostData | undefined;

  readonly when = {
    activeOverridesIncluded: (): this => {
      const activeOverrides = extractActiveOverrideManifests(this.hostData);
      this.result = includeOverrideAppsInCatalog({
        hostData: this.hostData,
        overrideManifests: activeOverrides.values(),
      });
      return this;
    },
  };

  readonly get = {
    catalogAppIds: (): string[] =>
      this.result?.catalog.apps.map((manifest) => manifest.id) ?? [],
    localAppId: (): string => this.localApp.id,
  };

  private aManifest(kind: 'app' | 'host', id: string): Manifest {
    return {
      schemaVersion: '1',
      kind,
      id,
      name: faker.commerce.productName(),
      version: faker.system.semver(),
      buildId: faker.string.uuid(),
      channel: kind === 'app' ? 'local' : 'production',
      framework: 'angular',
      remoteEntryUrl:
        kind === 'app'
          ? 'http://localhost:4203/remoteEntry.json'
          : faker.internet.url(),
      supportedHosts: kind === 'app' ? [this.hostId] : undefined,
      placements: kind === 'app' ? [{ hostId: this.hostId }] : undefined,
    };
  }
}
