import { createHash } from 'node:crypto';
import type {
  AtlasArtifactKind,
  AtlasDeploymentSelection,
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasRegistryArtifact,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  assertManifestDescriptor,
  assertPublishedArtifactManifest,
  assertReleaseVersion,
} from '@atlas/schema';

export interface AtlasRegistryMutation {
  registry: AtlasStaticRegistry;
  baseRevision: string;
  registryRevision: string;
  changed: boolean;
  replacedPreview?: AtlasManifestDescriptor;
}

export interface AtlasResolvedRelease {
  kind: AtlasArtifactKind;
  artifact: AtlasRegistryArtifact;
  version: string;
  manifest: AtlasManifestDescriptor;
}

export function emptyStaticRegistry(
  updatedAt = new Date().toISOString(),
): AtlasStaticRegistry {
  return withRegistryRevision({
    schemaVersion: '2',
    revision: emptyRevision(),
    updatedAt,
    hosts: {},
    apps: {},
    deployments: {},
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
  const registry = cloneRegistry(current ?? emptyStaticRegistry(updatedAt));
  assertStaticRegistry(registry);
  const baseRevision = registryRevision(registry);
  const kind = artifactKind(manifest);
  const collection = kind === 'app' ? registry.apps : registry.hosts;
  const otherCollection = kind === 'app' ? registry.hosts : registry.apps;
  if (otherCollection[manifest.id]) {
    throw new Error(
      `Atlas stable ID "${manifest.id}" is already registered to another artifact kind.`,
    );
  }
  assertUniqueName(
    { ...registry.apps, ...registry.hosts },
    manifest.id,
    manifest.name,
  );
  const artifact = collection[manifest.id] ?? {
    id: manifest.id,
    name: manifest.name,
    releases: {},
    previews: {},
  };
  artifact.name = manifest.name;
  let changed = false;
  let replacedPreview: AtlasManifestDescriptor | undefined;

  if (manifest.release) {
    const version = manifest.release.version;
    if (registry.deployments[version]) {
      throw new Error(
        `Release version "${version}" conflicts with an existing Atlas environment.`,
      );
    }
    const existing = artifact.releases[version];
    if (existing && existing.digest !== descriptor.digest) {
      throw new Error(
        `Immutable release ${manifest.id}@${version} already exists with a different digest.`,
      );
    }
    if (!existing) {
      artifact.releases[version] = descriptor;
      artifact.latest = version;
      changed = true;
    }
  } else if (manifest.preview) {
    const number = String(manifest.preview.number);
    const existing = artifact.previews[number];
    if (!sameDescriptor(existing, descriptor)) {
      replacedPreview = existing;
      artifact.previews[number] = descriptor;
      changed = true;
    }
  } else {
    throw new Error(
      'Published manifest must contain release or preview identity.',
    );
  }

  collection[manifest.id] = artifact;
  if (!changed) {
    return {
      registry,
      baseRevision,
      registryRevision: baseRevision,
      changed: false,
    };
  }
  registry.updatedAt = updatedAt;
  const revised = withRegistryRevision(registry);
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
  const registry = cloneRegistry(current);
  const baseRevision = registryRevision(current);
  const artifact = registry.apps[artifactId] ?? registry.hosts[artifactId];
  const removed = artifact?.previews[String(previewNumber)];
  if (!artifact || !removed) {
    return {
      registry,
      baseRevision,
      registryRevision: baseRevision,
      changed: false,
    };
  }
  delete artifact.previews[String(previewNumber)];
  registry.updatedAt = updatedAt;
  const revised = withRegistryRevision(registry);
  return {
    registry: revised,
    baseRevision,
    registryRevision: revised.revision,
    changed: true,
    removed,
  };
}

export function resolveRegistryArtifact(
  registry: AtlasStaticRegistry,
  identifier: string,
): { kind: AtlasArtifactKind; artifact: AtlasRegistryArtifact } {
  const byId = [
    ...(registry.apps[identifier]
      ? [{ kind: 'app' as const, artifact: registry.apps[identifier] }]
      : []),
    ...(registry.hosts[identifier]
      ? [{ kind: 'host' as const, artifact: registry.hosts[identifier] }]
      : []),
  ];
  if (byId.length === 1) return byId[0]!;
  const byName = [
    ...Object.values(registry.apps).flatMap((artifact) =>
      artifact.name === identifier ? [{ kind: 'app' as const, artifact }] : [],
    ),
    ...Object.values(registry.hosts).flatMap((artifact) =>
      artifact.name === identifier ? [{ kind: 'host' as const, artifact }] : [],
    ),
  ];
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    throw new Error(
      `Atlas artifact name "${identifier}" is ambiguous. Use one of these stable IDs: ${byName.map(({ artifact }) => artifact.id).join(', ')}.`,
    );
  }
  throw new Error(`Atlas artifact "${identifier}" is not registered.`);
}

export function resolveRelease(
  registry: AtlasStaticRegistry,
  identifier: string,
  selector: string,
): AtlasResolvedRelease {
  const { kind, artifact } = resolveRegistryArtifact(registry, identifier);
  const exact = artifact.releases[selector];
  const environment = registry.deployments[selector];
  const selected =
    environment?.[kind === 'app' ? 'apps' : 'hosts'][artifact.id];
  if (exact && selected) {
    throw new Error(
      `Selector "${selector}" matches both a release version and an environment.`,
    );
  }
  if (selector === 'latest') {
    if (!artifact.latest || !artifact.releases[artifact.latest]) {
      throw new Error(`Atlas artifact "${identifier}" has no latest release.`);
    }
    return {
      kind,
      artifact,
      version: artifact.latest,
      manifest: artifact.releases[artifact.latest]!,
    };
  }
  if (exact) return { kind, artifact, version: selector, manifest: exact };
  if (selected) {
    const manifest = artifact.releases[selected.version];
    if (!manifest) {
      throw new Error(
        `Atlas environment "${selector}" selects missing release "${selected.version}" for "${identifier}".`,
      );
    }
    return {
      kind,
      artifact,
      version: selected.version,
      manifest,
    };
  }
  throw new Error(
    `Atlas selector "${selector}" is neither a release nor a deployed environment for "${identifier}".`,
  );
}

export function selectDeployment(
  current: AtlasStaticRegistry,
  environment: string,
  selected: AtlasResolvedRelease,
  expectedHostRevisions: Record<string, string>,
  updatedAt = new Date().toISOString(),
): AtlasRegistryMutation {
  assertEnvironmentName(environment);
  const allArtifacts = [
    ...Object.values(current.apps),
    ...Object.values(current.hosts),
  ];
  if (allArtifacts.some((artifact) => artifact.releases[environment])) {
    throw new Error(
      `Environment "${environment}" conflicts with an existing release version.`,
    );
  }
  const registry = cloneRegistry(current);
  const baseRevision = registryRevision(current);
  const deployment = registry.deployments[environment] ?? {
    hosts: {},
    apps: {},
    expectedHostRevisions: {},
  };
  const selections =
    selected.kind === 'app' ? deployment.apps : deployment.hosts;
  const selection: AtlasDeploymentSelection = {
    version: selected.version,
  };
  selections[selected.artifact.id] = selection;
  deployment.expectedHostRevisions = {
    ...deployment.expectedHostRevisions,
    ...expectedHostRevisions,
  };
  registry.deployments[environment] = deployment;
  registry.updatedAt = updatedAt;
  const revised = withRegistryRevision(registry);
  return {
    registry: revised,
    baseRevision,
    registryRevision: revised.revision,
    changed: true,
  };
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

export function importRelease(
  current: AtlasStaticRegistry,
  selected: AtlasResolvedRelease,
  updatedAt = new Date().toISOString(),
): AtlasStaticRegistry {
  const registry = cloneRegistry(current);
  const collection = selected.kind === 'app' ? registry.apps : registry.hosts;
  const other = selected.kind === 'app' ? registry.hosts : registry.apps;
  if (other[selected.artifact.id]) {
    throw new Error(
      `Atlas stable ID "${selected.artifact.id}" is already registered to another artifact kind.`,
    );
  }
  assertUniqueName(
    { ...registry.apps, ...registry.hosts },
    selected.artifact.id,
    selected.artifact.name,
  );
  if (registry.deployments[selected.version]) {
    throw new Error(
      `Release version "${selected.version}" conflicts with an existing Atlas environment.`,
    );
  }
  const artifact = collection[selected.artifact.id] ?? {
    id: selected.artifact.id,
    name: selected.artifact.name,
    releases: {},
    previews: {},
  };
  const existing = artifact.releases[selected.version];
  if (existing && existing.digest !== selected.manifest.digest) {
    throw new Error(
      `Target release ${artifact.id}@${selected.version} has a different digest.`,
    );
  }
  artifact.releases[selected.version] = selected.manifest;
  collection[artifact.id] = artifact;
  registry.updatedAt = updatedAt;
  return withRegistryRevision(registry);
}

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

export function manifestBytes(
  manifest: AtlasPublishedArtifactManifest,
): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(manifest)}\n`);
}

export function descriptorFor(
  path: string,
  bytes: Uint8Array,
): AtlasManifestDescriptor {
  return {
    path,
    digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    size: bytes.byteLength,
    mediaType: 'application/json',
  };
}

export function assertStaticRegistry(
  value: unknown,
): asserts value is AtlasStaticRegistry {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as AtlasStaticRegistry).schemaVersion !== '2' ||
    !isRecord((value as AtlasStaticRegistry).apps) ||
    !isRecord((value as AtlasStaticRegistry).hosts) ||
    !isRecord((value as AtlasStaticRegistry).deployments)
  ) {
    throw new Error(
      'Atlas registry.json is malformed or not schemaVersion "2".',
    );
  }
  const registry = value as AtlasStaticRegistry;
  assertRegistryContents(registry);
  if (registry.revision !== registryRevision(registry)) {
    throw new Error('Atlas registry.json content revision is invalid.');
  }
}

function assertRegistryContents(registry: AtlasStaticRegistry): void {
  const names = new Map<string, string>();
  for (const [kind, collection] of [
    ['apps', registry.apps],
    ['hosts', registry.hosts],
  ] as const) {
    for (const [key, artifact] of Object.entries(collection)) {
      if (!isRecord(artifact) || artifact.id !== key || !artifact.name) {
        throw new Error(
          `Atlas registry ${kind}.${key} has an invalid identity.`,
        );
      }
      const existingName = names.get(artifact.name);
      if (existingName && existingName !== artifact.id) {
        throw new Error(
          `Atlas registry display name "${artifact.name}" is ambiguous.`,
        );
      }
      names.set(artifact.name, artifact.id);
      assertDescriptorMap(artifact.releases, `${kind}.${key}.releases`, true);
      assertDescriptorMap(artifact.previews, `${kind}.${key}.previews`, false);
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
  for (const [environment, deployment] of Object.entries(
    registry.deployments,
  )) {
    assertEnvironmentName(environment);
    for (const artifact of [
      ...Object.values(registry.apps),
      ...Object.values(registry.hosts),
    ]) {
      if (artifact.releases[environment]) {
        throw new Error(
          `Atlas environment "${environment}" conflicts with a release version.`,
        );
      }
    }
    assertDeploymentSelections(registry, deployment.apps, 'apps', environment);
    assertDeploymentSelections(
      registry,
      deployment.hosts,
      'hosts',
      environment,
    );
    for (const [hostId, revision] of Object.entries(
      deployment.expectedHostRevisions,
    )) {
      if (!registry.hosts[hostId] || !/^sha256:[0-9a-f]{64}$/u.test(revision)) {
        throw new Error(
          `Atlas deployment ${environment} has invalid expected revision for ${hostId}.`,
        );
      }
    }
  }
}

function assertDescriptorMap(
  value: unknown,
  subject: string,
  releases: boolean,
): void {
  if (!isRecord(value))
    throw new Error(`Atlas registry ${subject} must be an object.`);
  for (const [key, descriptor] of Object.entries(value)) {
    if (releases) assertReleaseVersion(key);
    else if (!Number.isSafeInteger(Number(key)) || Number(key) < 1) {
      throw new Error(
        `Atlas registry ${subject}.${key} is not a preview number.`,
      );
    }
    assertManifestDescriptor(descriptor, `${subject}.${key}`);
  }
}

function assertDeploymentSelections(
  registry: AtlasStaticRegistry,
  selections: Record<string, AtlasDeploymentSelection>,
  kind: 'apps' | 'hosts',
  environment: string,
): void {
  if (!isRecord(selections)) {
    throw new Error(
      `Atlas deployment ${environment}.${kind} must be an object.`,
    );
  }
  for (const [id, selection] of Object.entries(selections)) {
    const artifact = registry[kind][id];
    if (!artifact || !isRecord(selection)) {
      throw new Error(
        `Atlas deployment ${environment}.${kind}.${id} is invalid.`,
      );
    }
    assertReleaseVersion(selection.version);
    const release = artifact.releases[selection.version];
    if (!release || Object.keys(selection).length !== 1) {
      throw new Error(
        `Atlas deployment ${environment}.${kind}.${id} does not select a registered release.`,
      );
    }
  }
}

function artifactKind(
  manifest: AtlasPublishedArtifactManifest,
): AtlasArtifactKind {
  return manifest.kind === 'app-artifact' ? 'app' : 'host';
}

function assertUniqueName(
  collection: Record<string, AtlasRegistryArtifact>,
  id: string,
  name: string,
): void {
  const collision = Object.values(collection).find(
    (artifact) => artifact.id !== id && artifact.name === name,
  );
  if (collision) {
    throw new Error(
      `Atlas display name "${name}" is already registered to ${collision.id}. Names must be unique within registry.`,
    );
  }
}

function sameDescriptor(
  left: AtlasManifestDescriptor | undefined,
  right: AtlasManifestDescriptor,
): boolean {
  return Boolean(
    left &&
    left.path === right.path &&
    left.digest === right.digest &&
    left.size === right.size &&
    left.mediaType === right.mediaType,
  );
}

function withRegistryRevision(
  registry: AtlasStaticRegistry,
): AtlasStaticRegistry {
  registry.revision = registryRevision(registry) as `sha256:${string}`;
  return registry;
}

function emptyRevision(): `sha256:${string}` {
  return `sha256:${'0'.repeat(64)}`;
}

function cloneRegistry(registry: AtlasStaticRegistry): AtlasStaticRegistry {
  return structuredClone(registry);
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
