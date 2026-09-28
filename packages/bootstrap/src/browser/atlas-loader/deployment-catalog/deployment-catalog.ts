import type {
  AtlasDeploymentManifestReference,
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasHostManifest,
  AtlasManifest,
} from '@atlas/schema';
import {
  assertHostDeploymentManifest,
  buildEnvironmentManifestUrl,
  errorSummary,
} from '@atlas/schema';
import { decodeJson } from '../../../shared/decode-json/decode-json.js';
import { DeploymentInvalidError } from '../../../shared/errors/index.js';
import { mapWithConcurrency } from '../../../shared/map-with-concurrency/map-with-concurrency.js';
import {
  ARTIFACT_LOAD_CONCURRENCY,
  DEPLOYMENT_CATALOG_GENERATED_AT,
} from '../atlas-loader.constants.js';
import type {
  AtlasLoaderDependencies,
  LoaderContext,
} from '../atlas-loader.types.js';

export type DeploymentCatalogDependencies = Pick<
  AtlasLoaderDependencies,
  'fetchBytes' | 'loadPublishedArtifact' | 'logError'
>;

export interface DeploymentCatalogContext extends Pick<
  LoaderContext,
  'runtime'
> {
  dependencies: DeploymentCatalogDependencies;
}

export async function loadDeploymentCatalog({
  runtime,
  dependencies,
}: DeploymentCatalogContext): Promise<AtlasHostCatalog> {
  const deployment = await fetchDeploymentManifest({ runtime, dependencies });

  const manifests = await mapWithConcurrency({
    values: collectDeploymentManifestReferences(deployment),
    operation: (reference) =>
      reference === deployment.host
        ? dependencies.loadPublishedArtifact({ reference, runtime })
        : loadAppManifest({ reference, runtime, dependencies }),
    concurrency: ARTIFACT_LOAD_CONCURRENCY,
  });

  const host = manifests[0];

  if (!host || host.kind !== 'host') {
    throw new DeploymentInvalidError(
      `Atlas deployment manifest host reference "${deployment.host.path}" does not resolve to a host manifest.`,
    );
  }

  const appCount = deployment.apps.length;
  const apps = manifests.slice(1, 1 + appCount).filter(isAppManifest);
  const widgetProviders = manifests.slice(1 + appCount).filter(isAppManifest);

  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    generatedAt: DEPLOYMENT_CATALOG_GENERATED_AT,
    host,
    apps,
    ...(deployment.widgetProviders?.length ? { widgetProviders } : {}),
  };
}

async function loadAppManifest({
  reference,
  runtime,
  dependencies,
}: DeploymentCatalogContext & {
  reference: AtlasDeploymentManifestReference;
}): Promise<AtlasManifest | undefined> {
  try {
    const manifest = await dependencies.loadPublishedArtifact({
      reference,
      runtime,
    });

    if (manifest.kind === 'app') return manifest;

    dependencies.logError(
      `Atlas skipped "${reference.path}" because it is a ${manifest.kind} artifact, not an app. The rest of the host still loads.`,
      manifest,
    );
  } catch (failure) {
    dependencies.logError(
      `Atlas skipped "${reference.path}" because its manifest could not be loaded. The rest of the host still loads.`,
      failure,
    );
  }

  return undefined;
}

function isAppManifest(
  manifest: AtlasManifest | AtlasHostManifest | undefined,
): manifest is AtlasManifest {
  return manifest?.kind === 'app';
}

async function fetchDeploymentManifest({
  runtime,
  dependencies,
}: DeploymentCatalogContext): Promise<AtlasHostDeploymentManifest> {
  const url = buildEnvironmentManifestUrl(runtime);
  const deployment = decodeJson(
    await dependencies.fetchBytes({ url, runtime }),
  );

  try {
    assertHostDeploymentManifest(deployment);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);

    throw new DeploymentInvalidError(
      `Atlas deployment manifest at "${url}" is invalid: ${errorSummary(detail)}`,
      { cause },
    );
  }

  if (
    deployment.hostId !== runtime.hostId ||
    deployment.environment !== runtime.environment
  ) {
    throw new DeploymentInvalidError(
      `Atlas deployment manifest targets host "${deployment.hostId}" in environment "${deployment.environment}" but runtime selects host "${runtime.hostId}" in environment "${runtime.environment}".`,
    );
  }

  return deployment;
}

function collectDeploymentManifestReferences(
  deployment: AtlasHostDeploymentManifest,
): AtlasDeploymentManifestReference[] {
  return [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
}
