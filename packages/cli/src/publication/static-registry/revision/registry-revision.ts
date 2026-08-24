import { createHash } from 'node:crypto';
import type { AtlasStaticRegistry } from '@atlas/schema';

export function registryRevision(
  registry: AtlasStaticRegistry | undefined,
): string {
  const value = registry
    ? {
        schemaVersion: registry.schemaVersion,
        apps: registry.apps,
        hosts: registry.hosts,
        deployments: registry.deployments,
      }
    : { schemaVersion: '2', apps: {}, hosts: {}, deployments: {} };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
