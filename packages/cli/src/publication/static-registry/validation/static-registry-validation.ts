import type {
  AtlasDeploymentSelection,
  AtlasHostDeploymentSelection,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  assertManifestDescriptor,
  assertReleaseVersion,
  normalizeAtlasHostBaseUrl,
  normalizeAtlasRegistryRoot,
} from '@atlas/schema';
import { registryRevision } from '../revision/registry-revision.js';

export function assertStaticRegistry(
  value: unknown,
): asserts value is AtlasStaticRegistry {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '2' ||
    !isRecord(value.apps) ||
    !isRecord(value.hosts) ||
    !isRecord(value.deployments)
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

export function assertUniqueHostBaseUrls(
  registry: AtlasStaticRegistry,
  target: {
    environment: string;
    hostId: string;
    baseUrls: readonly string[];
  },
): void {
  const {
    environment: targetEnvironment,
    hostId: targetHostId,
    baseUrls,
  } = target;
  for (const [environment, deployment] of Object.entries(
    registry.deployments,
  )) {
    for (const [hostId, selection] of Object.entries(deployment.hosts)) {
      if (environment === targetEnvironment && hostId === targetHostId)
        continue;
      const collision = selection.baseUrls?.find((url) =>
        baseUrls.includes(url),
      );
      if (collision) {
        throw new Error(
          `Atlas host URL "${collision}" is already bound to host "${hostId}" in environment "${environment}".`,
        );
      }
    }
  }
}

function assertRegistryContents(registry: AtlasStaticRegistry): void {
  assertArtifactCollections(registry);
  assertDeployments(registry);
  assertUniqueRegistryHostBaseUrls(registry);
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

function assertDeployments(registry: AtlasStaticRegistry): void {
  for (const [environment, deployment] of Object.entries(
    registry.deployments,
  )) {
    assertEnvironmentName(environment);
    assertEnvironmentDoesNotMatchRelease(registry, environment);
    assertDeploymentSelections({
      registry,
      selections: deployment.apps,
      kind: 'apps',
      environment,
    });
    assertDeploymentSelections({
      registry,
      selections: deployment.hosts,
      kind: 'hosts',
      environment,
    });
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

function assertEnvironmentDoesNotMatchRelease(
  registry: AtlasStaticRegistry,
  environment: string,
): void {
  const artifacts = [
    ...Object.values(registry.apps),
    ...Object.values(registry.hosts),
  ];
  if (artifacts.some((artifact) => artifact.releases[environment])) {
    throw new Error(
      `Atlas environment "${environment}" conflicts with a release version.`,
    );
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

interface DeploymentSelectionValidation {
  readonly registry: AtlasStaticRegistry;
  readonly selections: Record<string, AtlasDeploymentSelection>;
  readonly kind: 'apps' | 'hosts';
  readonly environment: string;
}

function assertDeploymentSelections(
  validation: DeploymentSelectionValidation,
): void {
  const { registry, selections, kind, environment } = validation;
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
    if (
      !artifact.releases[selection.version] ||
      !hasValidSelectionFields(selection, kind)
    ) {
      throw new Error(
        `Atlas deployment ${environment}.${kind}.${id} does not select a registered release.`,
      );
    }
    if (kind === 'hosts') {
      assertHostSelection(
        selection as AtlasHostDeploymentSelection,
        `${environment}.${id}`,
      );
    }
  }
}

function hasValidSelectionFields(
  selection: AtlasDeploymentSelection,
  kind: 'apps' | 'hosts',
): boolean {
  const fields = Object.keys(selection);
  return kind === 'apps'
    ? fields.length === 1 && fields[0] === 'version'
    : fields.every((field) =>
        ['version', 'baseUrls', 'externalRegistries'].includes(field),
      );
}

function assertHostSelection(
  selection: AtlasHostDeploymentSelection,
  subject: string,
): void {
  assertExternalRegistrySelections(selection.externalRegistries, subject);
  if (selection.baseUrls === undefined) return;
  if (!Array.isArray(selection.baseUrls) || selection.baseUrls.length === 0) {
    throw new Error(
      `Atlas deployment ${subject}.baseUrls must be a non-empty array.`,
    );
  }
  const normalized = selection.baseUrls.map(normalizeAtlasHostBaseUrl);
  if (
    new Set(normalized).size !== normalized.length ||
    normalized.some((baseUrl, index) => baseUrl !== selection.baseUrls?.[index])
  ) {
    throw new Error(
      `Atlas deployment ${subject}.baseUrls must contain unique normalized URLs.`,
    );
  }
}

function assertExternalRegistrySelections(
  selections: AtlasHostDeploymentSelection['externalRegistries'],
  subject: string,
): void {
  if (selections === undefined) return;
  if (!Array.isArray(selections)) {
    throw new Error(
      `Atlas deployment ${subject}.externalRegistries must be an array.`,
    );
  }
  const identities = new Set<string>();
  for (const value of selections as unknown[]) {
    if (
      !isRecord(value) ||
      Object.keys(value).some(
        (field) => field !== 'registryUrl' && field !== 'environment',
      ) ||
      typeof value.registryUrl !== 'string' ||
      typeof value.environment !== 'string'
    ) {
      throw new Error(
        `Atlas deployment ${subject}.externalRegistries contains an invalid selection.`,
      );
    }
    assertEnvironmentName(value.environment);
    if (normalizeAtlasRegistryRoot(value.registryUrl) !== value.registryUrl) {
      throw new Error(
        `Atlas deployment ${subject}.externalRegistries must use normalized registry URLs.`,
      );
    }
    const identity = `${value.registryUrl}|${value.environment}`;
    if (identities.has(identity)) {
      throw new Error(
        `Atlas deployment ${subject}.externalRegistries contains duplicate selections.`,
      );
    }
    identities.add(identity);
  }
}

function assertUniqueRegistryHostBaseUrls(registry: AtlasStaticRegistry): void {
  const owners = new Map<string, string>();
  for (const [environment, deployment] of Object.entries(
    registry.deployments,
  )) {
    for (const [hostId, selection] of Object.entries(deployment.hosts)) {
      for (const baseUrl of selection.baseUrls ?? []) {
        const owner = `${environment}/${hostId}`;
        const existingOwner = owners.get(baseUrl);
        if (existingOwner && existingOwner !== owner) {
          throw new Error(
            `Atlas host URL "${baseUrl}" is assigned to both ${existingOwner} and ${owner}.`,
          );
        }
        owners.set(baseUrl, owner);
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
