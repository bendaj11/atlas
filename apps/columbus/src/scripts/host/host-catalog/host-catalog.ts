import {
  environmentManifestUrl,
  resolveAtlasRuntimeConfig,
} from '@atlas/bootstrap/runtime';
import type {
  ArtifactVersion,
  AtlasHostData as HostData,
} from '../../../types/contracts';
import { mapWithConcurrency } from '../../shared/concurrency/concurrency';
import { isRecord } from '../../shared/messages/messages';
import {
  fetchWithTimeout,
  type ManifestReference,
  manifestReference,
} from '../manifest-fetch/manifest-fetch';

type RuntimeConfig = HostData['config'];
type Catalog = HostData['catalog'];

interface HostDeployment {
  schemaVersion: 'v1';
  kind: 'host-deployment';
  hostId: string;
  environment: string;
  deploymentRevision: string;
  host: ManifestReference;
  apps: ManifestReference[];
  widgetProviders?: ManifestReference[];
}

const LOOKUP_CONCURRENCY = 8;

export async function readRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetchWithTimeout('/atlas.runtime.json');
  if (!response.ok)
    throw new Error(`Atlas runtime config returned ${response.status}.`);

  const value: unknown = await response.json();

  return resolveAtlasRuntimeConfig(value, globalThis.location.href);
}

export async function readCatalog(
  config: RuntimeConfig,
  loadManifest: (reference: ManifestReference) => Promise<ArtifactVersion>,
): Promise<Catalog> {
  if (config.environment !== 'development')
    return readDeployedCatalog(config, loadManifest);

  return readSnapshotCatalog(config) ?? readDevelopmentSessionCatalog(config);
}

function readSnapshotCatalog(config: RuntimeConfig): Catalog | undefined {
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
      !isRecord(snapshot.catalog) ||
      snapshot.catalog.hostId !== config.hostId
    )
      return undefined;

    return snapshot.catalog as unknown as Catalog;
  } catch {
    return undefined;
  }
}

async function readDevelopmentSessionCatalog(
  config: RuntimeConfig,
): Promise<Catalog> {
  if (!config.developmentSessionUrl)
    throw new Error('Atlas development session URL is missing.');

  const response = await fetchWithTimeout(config.developmentSessionUrl);
  if (!response.ok)
    throw new Error(`Atlas development session returned ${response.status}.`);

  const session: unknown = await response.json();
  if (
    !isRecord(session) ||
    !isRecord(session.catalog) ||
    session.catalog.hostId !== config.hostId
  )
    throw new Error('Atlas development session returned invalid data.');

  return session.catalog as unknown as Catalog;
}

async function readDeployedCatalog(
  config: RuntimeConfig,
  loadManifest: (reference: ManifestReference) => Promise<ArtifactVersion>,
): Promise<Catalog> {
  const response = await fetchWithTimeout(environmentManifestUrl(config));
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
    environment: deployment.environment,
    host,
    apps: manifests.slice(1, 1 + appCount),
    ...(deployment.widgetProviders?.length
      ? { widgetProviders: manifests.slice(1 + appCount) }
      : {}),
  };
}

function isHostDeployment(
  value: unknown,
  config: RuntimeConfig,
): value is HostDeployment {
  return (
    isRecord(value) &&
    value.schemaVersion === 'v1' &&
    value.kind === 'host-deployment' &&
    value.hostId === config.hostId &&
    value.environment === config.environment &&
    isRecord(value.host) &&
    Array.isArray(value.apps)
  );
}
