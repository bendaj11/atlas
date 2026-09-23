import {
  type AtlasHostCatalog,
  type AtlasHostDeploymentManifest,
  type AtlasHostRuntimeConfig,
  buildEnvironmentManifestUrl,
  resolveAtlasHostRuntimeConfig,
  validateAtlasHostCatalog,
  validateHostDeploymentManifest,
} from '@atlas/schema';
import {
  type ArtifactVersion,
  isAppArtifactVersion,
} from '../../types/artifact-version';
import { mapWithConcurrency } from '../concurrency/concurrency';
import { isRecord } from '../messages/messages';
import {
  fetchWithTimeout,
  type ManifestReference,
  manifestReference,
} from '../manifest-fetch/manifest-fetch';

const LOOKUP_CONCURRENCY = 8;

export async function readRuntimeConfig(): Promise<AtlasHostRuntimeConfig> {
  const response = await fetchWithTimeout('/atlas.runtime.json');
  if (!response.ok)
    throw new Error(`Atlas runtime config returned ${response.status}.`);

  const value: unknown = await response.json();

  return resolveAtlasHostRuntimeConfig(value, globalThis.location.href);
}

export async function readCatalog(
  config: AtlasHostRuntimeConfig,
  loadManifest: (reference: ManifestReference) => Promise<ArtifactVersion>,
): Promise<AtlasHostCatalog> {
  if (config.environment !== 'development')
    return readDeployedCatalog(config, loadManifest);

  return readSnapshotCatalog(config) ?? readDevelopmentSessionCatalog(config);
}

function readSnapshotCatalog(
  config: AtlasHostRuntimeConfig,
): AtlasHostCatalog | undefined {
  const content = document.getElementById(
    'atlas-runtime-snapshot',
  )?.textContent;
  if (!content) return undefined;

  try {
    const snapshot: unknown = JSON.parse(content);
    if (
      !isRecord(snapshot) ||
      snapshot.schemaVersion !== '1' ||
      !isRecord(snapshot.runtime) ||
      snapshot.runtime.hostId !== config.hostId ||
      snapshot.runtime.environment !== config.environment ||
      !isHostCatalog(snapshot.catalog) ||
      snapshot.catalog.hostId !== config.hostId
    )
      return undefined;

    return snapshot.catalog;
  } catch {
    return undefined;
  }
}

async function readDevelopmentSessionCatalog(
  config: AtlasHostRuntimeConfig,
): Promise<AtlasHostCatalog> {
  if (!config.developmentSessionUrl)
    throw new Error('Atlas development session URL is missing.');

  const response = await fetchWithTimeout(config.developmentSessionUrl);
  if (!response.ok)
    throw new Error(`Atlas development session returned ${response.status}.`);

  const session: unknown = await response.json();
  if (
    !isRecord(session) ||
    !isHostCatalog(session.catalog) ||
    session.catalog.hostId !== config.hostId
  )
    throw new Error('Atlas development session returned invalid data.');

  return session.catalog;
}

async function readDeployedCatalog(
  config: AtlasHostRuntimeConfig,
  loadManifest: (reference: ManifestReference) => Promise<ArtifactVersion>,
): Promise<AtlasHostCatalog> {
  const response = await fetchWithTimeout(buildEnvironmentManifestUrl(config));
  if (!response.ok)
    throw new Error(`Atlas host manifest returned ${response.status}.`);

  const deployment: unknown = await response.json();
  if (!isHostDeployment(deployment, config))
    throw new Error('Atlas host manifest returned invalid data.');

  const references = [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
  const manifests = await mapWithConcurrency(
    references,
    (descriptor) =>
      loadManifest(manifestReference(config.artifactRegistryUrl, descriptor)),
    LOOKUP_CONCURRENCY,
  );
  const host = manifests[0];
  if (!host || host.kind !== 'host')
    throw new Error('Host selection is invalid.');

  const appCount = deployment.apps.length;

  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    generatedAt: new Date().toISOString(),
    host,
    apps: manifests.slice(1, 1 + appCount).filter(isAppArtifactVersion),
    ...(deployment.widgetProviders?.length
      ? {
          widgetProviders: manifests
            .slice(1 + appCount)
            .filter(isAppArtifactVersion),
        }
      : {}),
  };
}

function isHostDeployment(
  value: unknown,
  config: AtlasHostRuntimeConfig,
): value is AtlasHostDeploymentManifest {
  return (
    validateHostDeploymentManifest(value).length === 0 &&
    isRecord(value) &&
    value.hostId === config.hostId &&
    value.environment === config.environment
  );
}

function isHostCatalog(value: unknown): value is AtlasHostCatalog {
  return validateAtlasHostCatalog(value).length === 0;
}
