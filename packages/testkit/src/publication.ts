import { faker } from '@faker-js/faker';
import type {
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '@atlas/schema';

export function aSha256Digest(): `sha256:${string}` {
  return `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase()}`;
}

export function aRegistryUrl(): string {
  return `https://${faker.internet.domainName()}/${faker.lorem.slug()}`;
}

export function aManifestDescriptor(
  overrides: Partial<AtlasManifestDescriptor> = {},
): AtlasManifestDescriptor {
  return {
    path: `${faker.lorem.slug()}/manifest.json`,
    digest: aSha256Digest(),
    size: faker.number.int({ min: 1, max: 100_000 }),
    mediaType: 'application/json',
    ...overrides,
  };
}

export function aDeploymentManifest(
  overrides: Partial<AtlasHostDeploymentManifest> = {},
): AtlasHostDeploymentManifest {
  return {
    schemaVersion: 'v1',
    kind: 'host-deployment',
    hostId: faker.string.uuid(),
    environment: faker.word.noun(),
    deploymentRevision: aSha256Digest(),
    host: aManifestDescriptor(),
    apps: [aManifestDescriptor()],
    ...overrides,
  };
}

export function aStaticRegistry(
  overrides: Partial<AtlasStaticRegistry> = {},
): AtlasStaticRegistry {
  return {
    schemaVersion: '2',
    revision: aSha256Digest(),
    updatedAt: faker.date.recent().toISOString(),
    hosts: {},
    apps: {},
    ...overrides,
  };
}
