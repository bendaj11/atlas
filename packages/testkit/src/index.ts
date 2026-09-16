import { createManifestFromConfig, type AtlasManifest } from '@atlas/schema';
import { createAtlasSdk, type AtlasSdk } from '@atlas/sdk/host';
import { createMemoryNavigation } from './navigation.js';

export function createTestManifest(
  overrides: Partial<AtlasManifest> = {},
): AtlasManifest {
  return {
    ...createManifestFromConfig({
      config: {
        id: 'catalog',
        name: 'Catalog',
        framework: 'react',
        routes: [
          {
            hostId: 'host',
            path: '/catalog',
            title: 'Catalog',
          },
        ],
      },
      version: '1.0.0',
      buildId: 'test',
      remoteEntryUrl: 'http://localhost:4173/remoteEntry.js',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

export function createTestHostSdk(hostId = 'host'): AtlasSdk {
  return createAtlasSdk({
    hostId,
    navigation: createMemoryNavigation(),
  });
}

export { createMemoryNavigation } from './navigation.js';
export {
  ALL_CHANNELS,
  ALL_FRAMEWORKS,
  anAppManifest,
  aHostManifest,
  aVersionOf,
  PUBLISHED_CHANNELS,
} from './manifests.js';
export { aHostCatalog, aHostRuntimeConfig } from './host.js';
export { anAppConfig, aHostConfig } from './config.js';
export {
  aDeploymentManifest,
  aHostArtifactManifest,
  ALL_PAYLOAD_FILE_ROLES,
  IMMUTABLE_CACHE_CONTROL,
  aManifestDescriptor,
  anAppArtifactManifest,
  anEnvironmentDeployment,
  aPayloadFileDescriptor,
  aRegistryUrl,
  aSha256Digest,
  aStaticRegistry,
} from './publication.js';
