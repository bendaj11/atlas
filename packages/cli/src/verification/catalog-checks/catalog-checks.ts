import {
  assertAtlasHostManifest,
  assertAtlasManifest,
  placementTargetsHost,
  type AtlasHostCatalog,
  type AtlasHostDeploymentManifest,
  type AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { asRecord, errorMessage, nonEmptyString } from '../../shared/index.js';
import type { VerificationContext } from '../types.js';

export function verifyCatalog({
  runtime,
  catalog,
  context,
}: {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  context: VerificationContext;
}): void {
  verifyCatalogHost({ runtime, catalog, context });
  verifySelectedVersions({ catalog, context });
  verifyRouteOwnership({ catalog, context });
}

function verifyCatalogHost({
  runtime,
  catalog,
  context,
}: {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  context: VerificationContext;
}): void {
  if (catalog.hostId === runtime.hostId)
    context.checks.pass('catalog host', `Matches "${runtime.hostId}".`);
  else
    context.checks.fail(
      'catalog host',
      `Expected "${runtime.hostId}", received "${catalog.hostId}".`,
    );

  try {
    assertAtlasHostManifest(catalog.host);
    context.checks.pass(
      `${catalog.host.id} host manifest`,
      `${catalog.host.version} (${catalog.host.buildId}) is valid.`,
    );
  } catch (error) {
    context.checks.fail(
      `${catalog.host.id || 'unknown'} host manifest`,
      errorMessage(error),
    );
  }
}

function verifySelectedVersions({
  catalog,
  context,
}: {
  catalog: AtlasHostCatalog;
  context: VerificationContext;
}): void {
  const ids = new Set<string>();
  const selectedApps = [...catalog.apps, ...(catalog.widgetProviders ?? [])];

  for (const manifest of selectedApps) {
    try {
      assertAtlasManifest(manifest);
      context.checks.pass(
        `${manifest.id} manifest`,
        `${manifest.version} (${manifest.buildId}) is valid.`,
      );
    } catch (error) {
      context.checks.fail(
        `${manifest.id || 'unknown'} manifest`,
        errorMessage(error),
      );
    }

    if (ids.has(manifest.id))
      context.checks.fail(
        'catalog versions',
        `app "${manifest.id}" is selected more than once.`,
      );
    ids.add(manifest.id);
  }

  if (ids.size === selectedApps.length)
    context.checks.pass(
      'catalog versions',
      'Exactly one version is selected per app.',
    );
}

function verifyRouteOwnership({
  catalog,
  context,
}: {
  catalog: AtlasHostCatalog;
  context: VerificationContext;
}): void {
  const owners = new Map<string, string>();
  const conflicts: string[] = [];

  for (const manifest of catalog.apps) {
    for (const placement of manifest.placements) {
      if (
        !placementTargetsHost(placement, catalog.hostId) ||
        placement.kind !== 'route' ||
        !placement.route
      )
        continue;

      const path = normalizeRoutePath(placement.route.path);
      const owner = owners.get(path);

      if (owner)
        conflicts.push(
          `hostId "${catalog.hostId}" path "${path}" is declared by "${owner}" and "${manifest.id}"`,
        );
      owners.set(path, manifest.id);
    }
  }

  if (conflicts.length > 0)
    context.checks.fail(
      'route ownership',
      `Duplicate routes: ${conflicts.join(', ')}. In atlas.config.ts routes, each hostId can use a path only once. Use a different path or hostId.`,
    );
  else
    context.checks.pass('route ownership', 'Every exact path has one owner.');
}

export function isHostDeployment(
  value: unknown,
): value is AtlasHostDeploymentManifest {
  const record = asRecord(value);

  return (
    record?.schemaVersion === 'v1' &&
    record.kind === 'host-deployment' &&
    nonEmptyString(record.hostId) &&
    nonEmptyString(record.environment) &&
    nonEmptyString(record.deploymentRevision) &&
    asRecord(record.host) !== undefined &&
    Array.isArray(record.apps)
  );
}

export function withArtifactUrls({
  deployment,
  runtime,
}: {
  deployment: AtlasHostDeploymentManifest;
  runtime: AtlasHostRuntimeConfig;
}): AtlasHostDeploymentManifest {
  const reference = (descriptor: AtlasHostDeploymentManifest['host']) => ({
    ...descriptor,
    url: new URL(descriptor.path, `${runtime.artifactRegistryUrl}/`).href,
  });

  return {
    ...deployment,
    host: reference(deployment.host),
    apps: deployment.apps.map(reference),
    ...(deployment.widgetProviders
      ? { widgetProviders: deployment.widgetProviders.map(reference) }
      : {}),
  };
}

function normalizeRoutePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}
