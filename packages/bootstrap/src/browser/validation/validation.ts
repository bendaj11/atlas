import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { isLoopbackHostname } from '../../shared/loopback.js';

export const LOADER_API_VERSION = '1.0.0';

export function validateCatalog({
  runtime,
  catalog,
}: {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
}): void {
  if (catalog.schemaVersion !== '1')
    throw catalogError(
      `Atlas catalog schemaVersion must be "1", got ${JSON.stringify(catalog.schemaVersion)}.`,
    );
  if (catalog.hostId !== runtime.hostId)
    throw catalogError(
      `Atlas catalog belongs to host "${catalog.hostId}" but runtime selects host "${runtime.hostId}".`,
    );

  if (catalog.host.kind !== 'host' || catalog.host.id !== runtime.hostId)
    throw catalogError(
      `Atlas catalog host entry must be a host manifest with id "${runtime.hostId}", got ${describeManifest(catalog.host)}.`,
    );

  const invalidApp = Array.isArray(catalog.apps)
    ? catalog.apps.find((manifest) => manifest.kind !== 'app')
    : undefined;
  if (!Array.isArray(catalog.apps) || invalidApp)
    throw catalogError(
      invalidApp
        ? `Atlas catalog apps must contain app manifests only, got ${describeManifest(invalidApp)}.`
        : 'Atlas catalog apps must be an array.',
    );

  if (catalog.widgetProviders) {
    const invalidProvider = Array.isArray(catalog.widgetProviders)
      ? catalog.widgetProviders.find((manifest) => manifest.kind !== 'app')
      : undefined;
    if (!Array.isArray(catalog.widgetProviders) || invalidProvider)
      throw catalogError(
        invalidProvider
          ? `Atlas catalog widget providers must contain app manifests only, got ${describeManifest(invalidProvider)}.`
          : 'Atlas catalog widget providers must be an array.',
      );
  }

  validateHostManifest({ manifest: catalog.host, runtime });
}

export function validateHostManifest({
  manifest,
  runtime,
}: {
  manifest: AtlasHostManifest;
  runtime: AtlasHostRuntimeConfig;
}): void {
  if (manifest.kind !== 'host' || manifest.id !== runtime.hostId)
    throw hostManifestError(
      `Selected host manifest must be a host manifest with id "${runtime.hostId}", got ${describeManifest(manifest)}.`,
    );

  if (typeof manifest.exposes.entry !== 'string')
    throw hostManifestError(
      `Selected host manifest "${manifest.id}" has no entry expose.`,
    );

  const requiredMajor = Number(
    manifest.requiredLoaderApiVersion.match(/\d+/)?.[0],
  );
  if (requiredMajor !== Number(LOADER_API_VERSION.split('.')[0]))
    throw hostManifestError(
      `Selected host manifest "${manifest.id}" requires Atlas loader API ${manifest.requiredLoaderApiVersion} but this loader provides ${LOADER_API_VERSION}.`,
    );

  validateArtifactUrl({
    url: new URL(manifest.remoteEntryUrl),
    manifest,
    runtime,
  });
}

export function validateArtifactUrl({
  url,
  manifest,
  runtime,
}: {
  url: URL;
  manifest: AtlasHostManifest | AtlasManifest;
  runtime: AtlasHostRuntimeConfig;
}): void {
  const subject = `${describeManifest(manifest)} URL "${url.href}"`;

  if (manifest.channel === 'local') {
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw artifactUrlError(`Local ${subject} must use HTTP(S).`);
    if (!isLoopbackHostname(url.hostname))
      throw artifactUrlError(`Local ${subject} must use a loopback hostname.`);

    return;
  }

  const artifactRegistryUrl = new URL(
    runtime.artifactRegistryUrl,
    globalThis.location?.href,
  );
  if (
    url.protocol === 'http:' &&
    isLoopbackHostname(url.hostname) &&
    isLoopbackHostname(artifactRegistryUrl.hostname)
  )
    return;

  if (url.protocol !== 'https:')
    throw artifactUrlError(`Published ${subject} must use HTTPS.`);

  if (url.origin !== artifactRegistryUrl.origin)
    throw artifactUrlError(
      `Published ${subject} uses origin "${url.origin}" outside artifactRegistryUrl origin "${artifactRegistryUrl.origin}".`,
    );
}

function describeManifest(manifest: { kind: string; id: string }): string {
  return `${manifest.kind} manifest "${manifest.id}"`;
}

function catalogError(message: string) {
  return bootstrapError({ code: 'CATALOG_INVALID', message });
}

function hostManifestError(message: string) {
  return bootstrapError({ code: 'HOST_MANIFEST_INVALID', message });
}

function artifactUrlError(message: string) {
  return bootstrapError({ code: 'ARTIFACT_URL_REJECTED', message });
}
