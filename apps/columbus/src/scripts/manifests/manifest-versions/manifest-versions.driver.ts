import type { AtlasExtensionManifest } from '../../../types/contracts.js';
import { uniqueVersions } from './manifest-versions.js';

export class ManifestVersionsDriver {
  private versions: AtlasExtensionManifest[] = [];

  readonly given = {
    version: (overrides: Partial<AtlasExtensionManifest>): this => {
      this.versions.push(createManifest(overrides));
      return this;
    },
  };

  readonly get = {
    channels: (): AtlasExtensionManifest['channel'][] =>
      uniqueVersions(this.versions).map(({ channel }) => channel),
  };
}

function createManifest(
  overrides: Partial<AtlasExtensionManifest>,
): AtlasExtensionManifest {
  return {
    schemaVersion: '1',
    kind: 'app',
    id: 'orders',
    name: 'Orders',
    version: '1.0.0',
    buildId: 'build',
    channel: 'production',
    framework: 'react',
    remoteEntryUrl: 'https://cdn.example/remoteEntry.json',
    ...overrides,
  };
}
