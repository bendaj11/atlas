import {
  assertHostDeploymentManifest,
  hydratePublishedArtifactManifest,
  type AtlasHostCatalog,
  type AtlasHostDeploymentManifest,
  type AtlasManifest,
  type AtlasManifestDescriptor,
} from '@atlas/schema';
import { runResiliently } from '../../resilience/resilience.js';
import { mapWithConcurrency } from '../../shared/concurrency.js';
import { extractErrorMessage } from '../../shared/errors.js';
import { fetchBytesFromNetwork } from '../fetch-bytes.js';
import { AtlasRuntimeConfigurationError } from '../loader.errors.js';
import type {
  DeploymentManifestReference,
  LoadHostDeploymentOptions,
  LoadPublishedManifestOptions,
  PublishedManifest,
  ResolvedManifestReference,
} from './deployment.types.js';

const MANIFEST_DOWNLOAD_CONCURRENCY = 6;

export async function loadHostDeployment(
  options: LoadHostDeploymentOptions,
): Promise<AtlasHostCatalog> {
  const fetchBytes = options.fetchBytes ?? fetchBytesFromNetwork;
  const deploymentBytes = await runResiliently({
    operation: (signal) => fetchBytes(options.manifestUrl, signal),
    context: { stage: 'manifest', resource: options.manifestUrl },
    ...(options.requestPolicy ? { policy: options.requestPolicy } : {}),
  });
  const deployment = parseHostDeploymentFromBytes(
    deploymentBytes,
    options.manifestUrl,
  );

  assertDeploymentMatchesExpectation(deployment, options);

  const references = [
    deployment.host,
    ...deployment.apps,
    ...(deployment.widgetProviders ?? []),
  ];
  const manifests = await mapWithConcurrency(
    references,
    (reference) =>
      loadPublishedManifest({
        reference: resolveManifestReferenceUrl(reference, options),
        fetchBytes,
        ...(options.requestPolicy
          ? { requestPolicy: options.requestPolicy }
          : {}),
      }),
    MANIFEST_DOWNLOAD_CONCURRENCY,
  );
  const host = manifests[0];

  if (!host || host.kind !== 'host') {
    throw new AtlasRuntimeConfigurationError(
      'Active host manifest does not select a host artifact.',
    );
  }

  const appCount = deployment.apps.length;
  const apps = requireAppManifests(manifests.slice(1, 1 + appCount));
  const widgetProviders = requireAppManifests(manifests.slice(1 + appCount));

  return {
    schemaVersion: '1',
    hostId: deployment.hostId,
    revision: deployment.deploymentRevision,
    generatedAt: new Date(0).toISOString(),
    host,
    apps,
    ...(deployment.widgetProviders?.length ? { widgetProviders } : {}),
  };
}

function requireAppManifests(
  manifests: readonly PublishedManifest[],
): AtlasManifest[] {
  const apps: AtlasManifest[] = [];

  for (const manifest of manifests) {
    if (manifest.kind !== 'app') {
      throw new AtlasRuntimeConfigurationError(
        `Active host manifest references "${manifest.id}" as an app, but it is a ${manifest.kind} artifact.`,
      );
    }

    apps.push(manifest);
  }

  return apps;
}

export async function loadPublishedManifest(
  options: LoadPublishedManifestOptions,
): Promise<PublishedManifest> {
  const fetchBytes = options.fetchBytes ?? fetchBytesFromNetwork;
  const { reference } = options;
  const bytes = await runResiliently({
    operation: (signal) => fetchBytes(reference.url, signal),
    context: { stage: 'manifest', resource: reference.url },
    ...(options.requestPolicy ? { policy: options.requestPolicy } : {}),
  });

  await assertBytesMatchDescriptor(reference, bytes);

  return parseArtifactManifestFromBytes(bytes, reference.url);
}

function resolveManifestReferenceUrl(
  reference: DeploymentManifestReference,
  options: Pick<
    LoadHostDeploymentOptions,
    'artifactRegistryUrl' | 'manifestUrl'
  >,
): ResolvedManifestReference {
  if (reference.url) return { ...reference, url: reference.url };

  if (options.artifactRegistryUrl) {
    return {
      ...reference,
      url: new URL(reference.path, `${options.artifactRegistryUrl}/`).href,
    };
  }

  throw new AtlasRuntimeConfigurationError(
    `Atlas host deployment manifest at "${options.manifestUrl}" references "${reference.path}" without a url, and no artifactRegistryUrl was configured to resolve it.`,
  );
}

function assertDeploymentMatchesExpectation(
  deployment: AtlasHostDeploymentManifest,
  expectation: Pick<
    LoadHostDeploymentOptions,
    'expectedHostId' | 'expectedEnvironment'
  >,
): void {
  const hostMismatch =
    expectation.expectedHostId !== undefined &&
    deployment.hostId !== expectation.expectedHostId;
  const environmentMismatch =
    expectation.expectedEnvironment !== undefined &&
    deployment.environment !== expectation.expectedEnvironment;

  if (!hostMismatch && !environmentMismatch) return;

  throw new AtlasRuntimeConfigurationError(
    `Active host manifest selects host "${deployment.hostId}" in environment "${deployment.environment}", but runtime configuration selects host "${expectation.expectedHostId ?? deployment.hostId}" in environment "${expectation.expectedEnvironment ?? deployment.environment}".`,
  );
}

function parseHostDeploymentFromBytes(
  bytes: ArrayBuffer,
  url: string,
): AtlasHostDeploymentManifest {
  const value = parseJsonFromBytes(bytes, url);

  try {
    assertHostDeploymentManifest(value);
  } catch (error) {
    throw new AtlasRuntimeConfigurationError(
      `Atlas host deployment manifest at "${url}" is invalid: ${extractErrorMessage(error)}`,
      error,
    );
  }

  return value;
}

function parseArtifactManifestFromBytes(
  bytes: ArrayBuffer,
  url: string,
): PublishedManifest {
  const value = parseJsonFromBytes(bytes, url);

  try {
    return hydratePublishedArtifactManifest(value, url);
  } catch (error) {
    throw new AtlasRuntimeConfigurationError(
      `Atlas artifact manifest at "${url}" is invalid: ${extractErrorMessage(error)}`,
      error,
    );
  }
}

async function assertBytesMatchDescriptor(
  descriptor: AtlasManifestDescriptor,
  bytes: ArrayBuffer,
): Promise<void> {
  if (bytes.byteLength !== descriptor.size) {
    throw new AtlasRuntimeConfigurationError(
      `Atlas manifest "${descriptor.path}" has an unexpected byte size: expected ${descriptor.size} bytes, received ${bytes.byteLength}.`,
    );
  }

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = `sha256:${[...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;

  if (actual !== descriptor.digest) {
    throw new AtlasRuntimeConfigurationError(
      `Atlas manifest "${descriptor.path}" failed SHA-256 verification.`,
    );
  }
}

function parseJsonFromBytes(bytes: ArrayBuffer, url: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new AtlasRuntimeConfigurationError(
      `Atlas received invalid JSON from "${url}": ${extractErrorMessage(error)}`,
      error,
    );
  }
}
