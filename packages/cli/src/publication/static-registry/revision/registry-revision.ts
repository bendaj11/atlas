import { createHash } from 'node:crypto';
import type { AtlasStaticRegistry } from '@atlas/schema';
import { isRecord } from '../../../shared/records/records.js';

export function registryRevision(
  registry: AtlasStaticRegistry | undefined,
): string {
  const value = registry
    ? {
        schemaVersion: registry.schemaVersion,
        apps: registry.apps,
        hosts: registry.hosts,
      }
    : { schemaVersion: '2', apps: {}, hosts: {} };
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}
