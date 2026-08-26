import type { AtlasStaticRegistry } from '@atlas/schema';
import {
  assertManifestDescriptor,
  assertReleaseVersion,
} from '@atlas/schema';
import { registryRevision } from '../revision/registry-revision.js';

export function assertStaticRegistry(
  value: unknown,
): asserts value is AtlasStaticRegistry {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '2' ||
    !isRecord(value.apps) ||
    !isRecord(value.hosts)
  ) {
    throw new Error(
      'Atlas registry.json is malformed or not schemaVersion "2".',
    );
  }
  const registry = value as unknown as AtlasStaticRegistry;
  assertRegistryContents(registry);
  if (registry.revision !== registryRevision(registry)) {
    throw new Error('Atlas registry.json content revision is invalid.');
  }
}

export function assertEnvironmentName(environment: string): void {
  if (
    environment === 'latest' ||
    !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(environment)
  ) {
    throw new Error(
      `Environment "${environment}" must be a URL-safe path segment; "latest" is reserved.`,
    );
  }
}

function assertRegistryContents(registry: AtlasStaticRegistry): void {
  assertArtifactCollections(registry);
}

function assertArtifactCollections(registry: AtlasStaticRegistry): void {
  const identifiers = new Map<string, string>();
  for (const [kind, collection] of [
    ['apps', registry.apps],
    ['hosts', registry.hosts],
  ] as const) {
    for (const [key, artifact] of Object.entries(collection)) {
      if (
        !isRecord(artifact) ||
        artifact.id !== key ||
        !artifact.name ||
        (artifact.packageName !== undefined &&
          (typeof artifact.packageName !== 'string' ||
            artifact.packageName.length === 0))
      ) {
        throw new Error(
          `Atlas registry ${kind}.${key} has an invalid identity.`,
        );
      }
      assertUniqueArtifactIdentifiers(artifact, identifiers);
      assertReleaseDescriptors(artifact.releases, `${kind}.${key}.releases`);
      assertPreviewDescriptors(artifact.previews, `${kind}.${key}.previews`);
      if (
        artifact.latest !== undefined &&
        !artifact.releases[artifact.latest]
      ) {
        throw new Error(
          `Atlas registry ${kind}.${key}.latest does not name a release.`,
        );
      }
    }
  }
}

function assertUniqueArtifactIdentifiers(
  artifact: { id: string; name: string; packageName?: string },
  identifiers: Map<string, string>,
): void {
  for (const identifier of [artifact.name, artifact.packageName].filter(
    (value): value is string => Boolean(value),
  )) {
    const existingId = identifiers.get(identifier);
    if (existingId && existingId !== artifact.id) {
      throw new Error(
        `Atlas registry identifier "${identifier}" is ambiguous.`,
      );
    }
    identifiers.set(identifier, artifact.id);
  }
}

function assertReleaseDescriptors(value: unknown, subject: string): void {
  assertDescriptorMap(value, subject, assertReleaseVersion);
}

function assertPreviewDescriptors(value: unknown, subject: string): void {
  assertDescriptorMap(value, subject, assertPreviewNumber);
}

function assertDescriptorMap(
  value: unknown,
  subject: string,
  assertKey: (value: string, subject: string) => void,
): void {
  if (!isRecord(value)) {
    throw new Error(`Atlas registry ${subject} must be an object.`);
  }
  for (const [key, descriptor] of Object.entries(value)) {
    assertKey(key, subject);
    assertManifestDescriptor(descriptor, `${subject}.${key}`);
  }
}

function assertPreviewNumber(value: string, subject: string): void {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error(
      `Atlas registry ${subject}.${value} is not a preview number.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
