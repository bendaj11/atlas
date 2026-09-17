import {
  assertManifestDescriptor,
  assertReleaseVersion,
  type AtlasManifestDescriptor,
  type AtlasRegistryArtifact,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { computeRegistryRevision } from '../revision/registry-revision.js';
import {
  isNonEmptyString,
  isRecord,
  type Sha256Digest,
} from '../../../shared/index.js';

export function assertStaticRegistry(
  value: unknown,
): asserts value is AtlasStaticRegistry {
  if (!isRecord(value) || value.schemaVersion !== '2') {
    throw new Error(
      'Atlas registry.json is malformed or not schemaVersion "2".',
    );
  }

  const { revision, updatedAt } = value;

  if (!isSha256Digest(revision) || typeof updatedAt !== 'string') {
    throw new Error(
      'Atlas registry.json is malformed or not schemaVersion "2".',
    );
  }

  const identifiers = new Map<string, string>();
  const apps = readArtifactCollection({
    value: value.apps,
    kind: 'apps',
    identifiers,
  });
  const hosts = readArtifactCollection({
    value: value.hosts,
    kind: 'hosts',
    identifiers,
  });
  const registry: AtlasStaticRegistry = {
    schemaVersion: '2',
    revision,
    updatedAt,
    apps,
    hosts,
  };

  if (revision !== computeRegistryRevision(registry)) {
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

function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === 'string' && value.startsWith('sha256:');
}

function readArtifactCollection({
  value,
  kind,
  identifiers,
}: {
  value: unknown;
  kind: 'apps' | 'hosts';
  identifiers: Map<string, string>;
}): Record<string, AtlasRegistryArtifact> {
  if (!isRecord(value)) {
    throw new Error(
      'Atlas registry.json is malformed or not schemaVersion "2".',
    );
  }

  const collection: Record<string, AtlasRegistryArtifact> = {};

  for (const [key, entry] of Object.entries(value)) {
    const artifact = readRegistryArtifact({ value: entry, kind, key });
    assertUniqueArtifactIdentifiers(artifact, identifiers);
    collection[key] = artifact;
  }

  return collection;
}

function readRegistryArtifact({
  value,
  kind,
  key,
}: {
  value: unknown;
  kind: 'apps' | 'hosts';
  key: string;
}): AtlasRegistryArtifact {
  if (
    !isRecord(value) ||
    value.id !== key ||
    !isNonEmptyString(value.name) ||
    (value.packageName !== undefined && !isNonEmptyString(value.packageName))
  ) {
    throw new Error(`Atlas registry ${kind}.${key} has an invalid identity.`);
  }

  const releases = readDescriptorMap(
    value.releases,
    `${kind}.${key}.releases`,
    assertReleaseVersion,
  );
  const previews = readDescriptorMap(
    value.previews,
    `${kind}.${key}.previews`,
    assertPreviewNumber,
  );
  const { latest } = value;

  if (
    latest !== undefined &&
    (typeof latest !== 'string' || !releases[latest])
  ) {
    throw new Error(
      `Atlas registry ${kind}.${key}.latest does not name a release.`,
    );
  }

  return {
    id: key,
    name: value.name,
    ...(value.packageName !== undefined
      ? { packageName: value.packageName }
      : {}),
    releases,
    previews,
    ...(latest !== undefined ? { latest } : {}),
  };
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

function readDescriptorMap(
  value: unknown,
  subject: string,
  assertKey: (value: string, subject: string) => void,
): Record<string, AtlasManifestDescriptor> {
  if (!isRecord(value)) {
    throw new Error(`Atlas registry ${subject} must be an object.`);
  }

  const descriptors: Record<string, AtlasManifestDescriptor> = {};

  for (const [key, descriptor] of Object.entries(value)) {
    assertKey(key, subject);
    assertManifestDescriptor(descriptor, `${subject}.${key}`);
    descriptors[key] = descriptor;
  }

  return descriptors;
}

function assertPreviewNumber(value: string, subject: string): void {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error(
      `Atlas registry ${subject}.${value} is not a preview number.`,
    );
  }
}
