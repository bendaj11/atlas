import { createHash } from 'node:crypto';
import type { AtlasStaticRegistry } from '@atlas/schema';
import { isRecord } from '../../../shared/index.js';

export function computeRegistryRevision(
  registry: AtlasStaticRegistry | undefined,
): string {
  const value = registry
    ? {
        schemaVersion: registry.schemaVersion,
        apps: registry.apps,
        hosts: registry.hosts,
      }
    : { schemaVersion: '2', apps: {}, hosts: {} };
  return `sha256:${createHash('sha256').update(stringifyCanonicalJson(value)).digest('hex')}`;
}

export function stringifyCanonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonKeys(value));
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);

  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJsonKeys(entry)]),
  );
}
