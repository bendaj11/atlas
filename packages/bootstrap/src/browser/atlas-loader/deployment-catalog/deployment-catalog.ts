import type {
  AtlasDeploymentManifestReference,
  AtlasHostCatalog,
  AtlasHostDeploymentManifest,
  AtlasManifest,
} from '@atlas/schema';
import {
  assertHostDeploymentManifest,
  environmentManifestUrl,
  errorSummary,
} from '@atlas/schema';
import { decodeJson } from '../../../shared/decode-json/decode-json.js';
import { bootstrapError } from '../../../shared/errors/index.js';
import { mapWithConcurrency } from '../../../shared/map-with-concurrency/map-with-concurrency.js';
import {
  ARTIFACT_LOAD_CONCURRENCY,
  DEPLOYMENT_CATALOG_GENERATED_AT,
} from '../atlas-loader.constants.js';
import type { LoaderContext } from '../atlas-loader.types.js';

export async function loadDeploymentCatalog({
  runtime,
  dependencies,
}: LoaderContext): Promise<AtlasHostCatalog> {
  const deployment = await fetchDeploymentManifest({ runtime, dependencies });

  const manifests = await mapWithConcurrency({
    values: deploymentManifestReferences(deployment),
    operation: (reference) =>
      dependencies.loadPublishedArtifact({ reference, runtime }),
    concurrency: ARTIFACT_LOAD_CONCURRENCY,
  });

  const host = manifests[0];

  if (!host || host.kind !== 'host') {
    throw deploymentError(
      `Atlas deployment manifest host reference "${deployment.host.path}" does not resolve to a host manifest.`,
    );
  }

  const appCount = deployment.apps.length;
  const apps = manifests.slice(1, 1 + appCount) as AtlasManifest[];
  const widgetProviders = manifests.slice(1 + appCount) as AtlasManifest[];

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

async function fetchDeploymentManifest({
  runtime,
  dependencies,
}: LoaderContext): Promise<AtlasHostDeploymentManifest> {
  const url = environmentManifestUrl(runtime);
  const deployment = decodeJson(
    await dependencies.fetchBytes({ url, runtime }),
  );

  try {
    assertHostDeploymentManifest(deployment);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);

    throw deploymentError(
      `Atlas deployment manifest at "${url}" is invalid: ${errorSummary(detail)}`,
      cause,
    );
  }

  if (
    deployment.hostId !== runtime.hostId ||
    deployment.environment !== runtime.environment
  ) {
    throw deploymentError(
      `Atlas deployment manifest targets host "${deployment.hostId}" in environment "${deployment.environment}" but runtime selects host "${runtime.hostId}" in environment "${runtime.environment}".`,
    );
  }

  return deployment;
}

function deploymentManifestReferences(
  deployment: AtlasHostDeploymentManifest,
): AtlasDeploymentManifestReference[] {
  return [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
}

function deploymentError(message: string, cause?: unknown) {
  return bootstrapError({
    code: 'DEPLOYMENT_INVALID',
    message,
    ...(cause === undefined ? {} : { cause }),
  });
}
