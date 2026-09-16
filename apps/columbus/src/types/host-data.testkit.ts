import { faker } from '@faker-js/faker';
import type { HostData } from './host-data';
import { aHostArtifactVersion } from './artifact-version.testkit';

export function aHostData(overrides: Partial<HostData> = {}): HostData {
  const hostId = faker.string.uuid();

  return {
    config: {
      schemaVersion: 'v1',
      hostId,
      environment: 'production',
      artifactRegistryUrl: faker.internet.url(),
    },
    pageUrl: faker.internet.url(),
    catalog: {
      schemaVersion: '1',
      hostId,
      revision: faker.string.uuid(),
      generatedAt: faker.date.recent().toISOString(),
      host: aHostArtifactVersion({ id: hostId }),
      apps: [],
    },
    overrides: undefined,
    overrideScope: undefined,
    versions: {},
    runtimeErrors: [],
    versionErrors: [],
    ...overrides,
  };
}
