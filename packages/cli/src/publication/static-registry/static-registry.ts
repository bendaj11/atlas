import {
  assertManifestDescriptor,
  assertPublishedArtifactManifest,
  type AtlasArtifactKind,
  type AtlasManifestDescriptor,
  type AtlasPublishedArtifactManifest,
  type AtlasRegistryArtifact,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { isSameDescriptor } from './descriptors/descriptors.js';
import { computeRegistryRevision } from './revision/registry-revision.js';
import type { AtlasRegistryMutation } from './types.js';
import { assertStaticRegistry } from './validation/static-registry-validation.js';

export function createEmptyStaticRegistry(
  updatedAt = new Date().toISOString(),
): AtlasStaticRegistry {
  return applyRegistryRevision({
    schemaVersion: '2',
    revision: `sha256:${'0'.repeat(64)}`,
    updatedAt,
    hosts: {},
    apps: {},
  });
}

export function publishArtifact(
  current: AtlasStaticRegistry | undefined,
  manifest: AtlasPublishedArtifactManifest,
  descriptor: AtlasManifestDescriptor,
  updatedAt = new Date().toISOString(),
): AtlasRegistryMutation {
  assertPublishedArtifactManifest(manifest);
  assertManifestDescriptor(descriptor);

  const registry = structuredClone(
    current ?? createEmptyStaticRegistry(updatedAt),
  );
  assertStaticRegistry(registry);

  const baseRevision = computeRegistryRevision(registry);
  const kind = resolveArtifactKind(manifest);
  const collection = kind === 'app' ? registry.apps : registry.hosts;
  const otherCollection = kind === 'app' ? registry.hosts : registry.apps;

  if (otherCollection[manifest.id])
    throw new Error(
      `Atlas stable ID "${manifest.id}" is already registered to another artifact kind.`,
    );

  assertUniqueName({
    collection: { ...registry.apps, ...registry.hosts },
    id: manifest.id,
    name: manifest.name,
    packageName: manifest.packageName,
  });

  const artifact = collection[manifest.id] ?? {
    id: manifest.id,
    name: manifest.name,
    ...(manifest.packageName ? { packageName: manifest.packageName } : {}),
    releases: {},
    previews: {},
  };
  const identityChanged = applyArtifactIdentity({ artifact, manifest });
  const { changed, replacedPreview } = applyArtifactVersion({
    artifact,
    manifest,
    descriptor,
  });
  collection[manifest.id] = artifact;

  if (!identityChanged && !changed)
    return createUnchangedMutation({ registry, baseRevision });

  registry.updatedAt = updatedAt;
  const revised = applyRegistryRevision(registry);

  return {
    registry: revised,
    baseRevision,
    registryRevision: revised.revision,
    changed: true,
    ...(replacedPreview ? { replacedPreview } : {}),
  };
}

export function removePreview(
  current: AtlasStaticRegistry,
  artifactId: string,
  previewNumber: number,
  updatedAt = new Date().toISOString(),
): AtlasRegistryMutation & { removed?: AtlasManifestDescriptor } {
  assertStaticRegistry(current);

  const registry = structuredClone(current);
  const baseRevision = computeRegistryRevision(current);
  const artifact = registry.apps[artifactId] ?? registry.hosts[artifactId];
  const removed = artifact?.previews[String(previewNumber)];

  if (!artifact || !removed)
    return createUnchangedMutation({ registry, baseRevision });

  delete artifact.previews[String(previewNumber)];
  registry.updatedAt = updatedAt;
  const revised = applyRegistryRevision(registry);

  return {
    registry: revised,
    baseRevision,
    registryRevision: revised.revision,
    changed: true,
    removed,
  };
}

function applyArtifactIdentity({
  artifact,
  manifest,
}: {
  artifact: AtlasRegistryArtifact;
  manifest: AtlasPublishedArtifactManifest;
}): boolean {
  artifact.name = manifest.name;

  if (manifest.packageName === undefined) return false;

  const changed = artifact.packageName !== manifest.packageName;
  artifact.packageName = manifest.packageName;

  return changed;
}

function applyArtifactVersion({
  artifact,
  manifest,
  descriptor,
}: {
  artifact: AtlasRegistryArtifact;
  manifest: AtlasPublishedArtifactManifest;
  descriptor: AtlasManifestDescriptor;
}): { changed: boolean; replacedPreview?: AtlasManifestDescriptor } {
  if (manifest.release) {
    const version = manifest.release.version;
    const existing = artifact.releases[version];

    if (existing && existing.digest !== descriptor.digest)
      throw new Error(
        `Immutable release ${manifest.id}@${version} already exists with a different digest.`,
      );

    if (existing) return { changed: false };

    artifact.releases[version] = descriptor;
    artifact.latest = version;

    return { changed: true };
  }

  if (manifest.preview) {
    const number = String(manifest.preview.number);
    const existing = artifact.previews[number];

    if (isSameDescriptor(existing, descriptor)) return { changed: false };

    artifact.previews[number] = descriptor;

    return { changed: true, replacedPreview: existing };
  }

  throw new Error(
    'Published manifest must contain release or preview identity.',
  );
}

function createUnchangedMutation({
  registry,
  baseRevision,
}: {
  registry: AtlasStaticRegistry;
  baseRevision: string;
}): AtlasRegistryMutation {
  return {
    registry,
    baseRevision,
    registryRevision: baseRevision,
    changed: false,
  };
}

function resolveArtifactKind(
  manifest: AtlasPublishedArtifactManifest,
): AtlasArtifactKind {
  return manifest.kind === 'app-artifact' ? 'app' : 'host';
}

function assertUniqueName({
  collection,
  id,
  name,
  packageName,
}: {
  collection: Record<string, AtlasRegistryArtifact>;
  id: string;
  name: string;
  packageName?: string;
}): void {
  const collision = Object.values(collection).find(
    (artifact) =>
      artifact.id !== id &&
      (artifact.name === name ||
        (packageName !== undefined &&
          (artifact.name === packageName ||
            artifact.packageName === packageName)) ||
        (artifact.packageName !== undefined && artifact.packageName === name)),
  );

  if (collision)
    throw new Error(
      `Atlas identifier "${packageName ?? name}" conflicts with ${collision.id}. Display and package names must be unique within registry.`,
    );
}

function applyRegistryRevision(
  registry: AtlasStaticRegistry,
): AtlasStaticRegistry {
  registry.revision = computeRegistryRevision(registry) as `sha256:${string}`;

  return registry;
}
