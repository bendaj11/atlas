import { faker } from '@faker-js/faker';
import type {
  AtlasEnvironmentDeployment,
  AtlasHostDeploymentManifest,
} from '@atlas/schema';
import { aSha256Digest } from '../identifiers/identifiers.js';
import { aManifestDescriptor } from '../payload-files/payload-files.js';

export function aHostDeploymentManifest(
  overrides: Partial<AtlasHostDeploymentManifest> = {},
): AtlasHostDeploymentManifest {
  return {
    schemaVersion: 'v1',
    kind: 'host-deployment',
    hostId: faker.string.uuid(),
    environment: faker.lorem.slug(),
    deploymentRevision: aSha256Digest(),
    host: aManifestDescriptor(),
    apps: [aManifestDescriptor()],
    ...overrides,
  };
}

export function anEnvironmentDeployment(
  overrides: Partial<AtlasEnvironmentDeployment> = {},
): AtlasEnvironmentDeployment {
  return {
    schemaVersion: 'v1',
    environment: faker.lorem.slug(),
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}
