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
  normalizeAtlasHostBaseUrl,
  normalizeAtlasRegistryRoot,
  assertPublishedArtifactManifest,
} from '@atlas/schema';
import {
  canonicalJson,
  registryRevision,
} from './revision/registry-revision.js';
import {
  assertEnvironmentName,
  assertStaticRegistry,
  assertUniqueHostBaseUrls,
} from './validation/static-registry-validation.js';

export {
  canonicalJson,
  registryRevision,
} from './revision/registry-revision.js';
export {
  assertEnvironmentName,
  assertStaticRegistry,
} from './validation/static-registry-validation.js';

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
    manifest.packageName,
  );
  const artifact = collection[manifest.id] ?? {
    id: manifest.id,
    name: manifest.name,
    ...(manifest.packageName ? { packageName: manifest.packageName } : {}),
    releases: {},
    previews: {},
  };
  artifact.name = manifest.name;
  const packageNameChanged =
    manifest.packageName !== undefined &&
    artifact.packageName !== manifest.packageName;
  if (manifest.packageName !== undefined)
    artifact.packageName = manifest.packageName;
  let changed = packageNameChanged;
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
  const byPackageName = [
    ...Object.values(registry.apps).flatMap((artifact) =>
      artifact.packageName === identifier
        ? [{ kind: 'app' as const, artifact }]
        : [],
    ),
    ...Object.values(registry.hosts).flatMap((artifact) =>
      artifact.packageName === identifier
        ? [{ kind: 'host' as const, artifact }]
        : [],
    ),
  ];
  const matches = [
    ...new Map(
      [...byPackageName, ...byName].map((match) => [match.artifact.id, match]),
    ).values(),
  ];
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(
      `Atlas artifact identifier "${identifier}" is ambiguous. Use one of these stable IDs: ${matches.map(({ artifact }) => artifact.id).join(', ')}.`,
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

export function bindHostDeployment(
  current: AtlasStaticRegistry,
  binding: {
    environment: string;
    hostId: string;
    baseUrls: readonly string[];
    externalRegistries?: readonly {
      registryUrl: string;
      environment: string;
    }[];
  },
  updatedAt = new Date().toISOString(),
): AtlasRegistryMutation {
  const { environment, hostId, baseUrls, externalRegistries } = binding;
  const normalizedBaseUrls = [
    ...new Set(baseUrls.map(normalizeAtlasHostBaseUrl)),
  ].sort();
  if (normalizedBaseUrls.length === 0) {
    throw new Error('Atlas host deployment requires at least one host URL.');
  }

  const registry = cloneRegistry(current);
  const deployment = registry.deployments[environment];
  const selection = deployment?.hosts[hostId];
  if (!selection) {
    throw new Error(
      `Atlas host "${hostId}" is not selected in environment "${environment}".`,
    );
  }
  assertUniqueHostBaseUrls(registry, {
    environment,
    hostId,
    baseUrls: normalizedBaseUrls,
  });

  const baseRevision = registryRevision(current);
  selection.baseUrls = normalizedBaseUrls;
  if (externalRegistries !== undefined) {
    selection.externalRegistries = externalRegistries
      .map(({ registryUrl, environment: externalEnvironment }) => ({
        registryUrl: normalizeAtlasRegistryRoot(registryUrl),
        environment: externalEnvironment,
      }))
      .sort((left, right) =>
        `${left.registryUrl}|${left.environment}`.localeCompare(
          `${right.registryUrl}|${right.environment}`,
        ),
      );
  }
  registry.updatedAt = updatedAt;
  const revised = withRegistryRevision(registry);
  return {
    registry: revised,
    baseRevision,
    registryRevision: revised.revision,
    changed: revised.revision !== baseRevision,
  };
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
    selected.artifact.packageName,
  );
  if (registry.deployments[selected.version]) {
    throw new Error(
      `Release version "${selected.version}" conflicts with an existing Atlas environment.`,
    );
  }
  const artifact = collection[selected.artifact.id] ?? {
    id: selected.artifact.id,
    name: selected.artifact.name,
    ...(selected.artifact.packageName
      ? { packageName: selected.artifact.packageName }
      : {}),
    releases: {},
    previews: {},
  };
  if (selected.artifact.packageName !== undefined)
    artifact.packageName = selected.artifact.packageName;
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

function artifactKind(
  manifest: AtlasPublishedArtifactManifest,
): AtlasArtifactKind {
  return manifest.kind === 'app-artifact' ? 'app' : 'host';
}

function assertUniqueName(
  collection: Record<string, AtlasRegistryArtifact>,
  id: string,
  name: string,
  packageName?: string,
): void {
  const collision = Object.values(collection).find(
    (artifact) =>
      artifact.id !== id &&
      (artifact.name === name ||
        (packageName !== undefined &&
          (artifact.name === packageName ||
            artifact.packageName === packageName)) ||
        (artifact.packageName !== undefined && artifact.packageName === name)),
  );
  if (collision) {
    throw new Error(
      `Atlas identifier "${packageName ?? name}" conflicts with ${collision.id}. Display and package names must be unique within registry.`,
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
