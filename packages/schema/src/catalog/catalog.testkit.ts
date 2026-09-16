import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog } from './atlas-host-catalog.js';
import { aHostManifest } from '../host-manifest/host-manifest.testkit.js';

export function aHostCatalog(
  overrides: Partial<AtlasHostCatalog> = {},
): AtlasHostCatalog {
  const host = overrides.host ?? aHostManifest();

  return {
    schemaVersion: '1',
    hostId: host.id,
    revision: `sha256:${faker.string.hexadecimal({ length: 64, prefix: '' })}`,
    generatedAt: faker.date.past().toISOString(),
    host,
    apps: [],
    ...overrides,
  };
}
