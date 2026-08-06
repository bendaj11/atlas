import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { LOADER_API_VERSION } from '../constants.js';

export function validateCatalog(
  runtime: AtlasHostRuntimeConfig,
  catalog: AtlasHostCatalog,
): void {
  if (catalog.schemaVersion !== '1' || catalog.hostId !== runtime.hostId)
    throw new Error('Atlas catalog does not match runtime host.');

  if (catalog.host.kind !== 'host' || catalog.host.id !== runtime.hostId)
    throw new Error('Atlas catalog has no matching host client.');

  if (
    !Array.isArray(catalog.apps) ||
    catalog.apps.some((manifest) => manifest.kind !== 'app')
  )
    throw new Error('Atlas catalog apps are invalid.');

  if (
    catalog.widgetProviders &&
    (!Array.isArray(catalog.widgetProviders) ||
      catalog.widgetProviders.some((manifest) => manifest.kind !== 'app'))
  ) {
    throw new Error('Atlas catalog widget providers are invalid.');
  }

  validateHostManifest(catalog.host, runtime);
}

export function validateHostManifest(
  manifest: AtlasHostManifest,
  runtime: AtlasHostRuntimeConfig,
): void {
  if (manifest.kind !== 'host' || manifest.id !== runtime.hostId)
    throw new Error('Selected host manifest does not match this server.');

  if (typeof manifest.exposes.entry !== 'string')
    throw new Error('Selected host manifest has no entry expose.');

  const requiredMajor = Number(
    manifest.requiredLoaderApiVersion.match(/\d+/)?.[0],
  );
  if (requiredMajor !== Number(LOADER_API_VERSION.split('.')[0]))
    throw new Error(
      'Selected host client requires an incompatible Atlas loader API.',
    );

  validateArtifactUrl(new URL(manifest.remoteEntryUrl), manifest, runtime);
}

export function validateArtifactUrl(
  url: URL,
  manifest: AtlasHostManifest | AtlasManifest,
  runtime: AtlasHostRuntimeConfig,
): void {
  const loopbackHosts = ['localhost', '127.0.0.1', '::1'];

  if (manifest.channel === 'local') {
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('Local host URL must use HTTP(S).');
    if (!loopbackHosts.includes(url.hostname))
      throw new Error('Local host URL must use loopback.');
    return;
  }

  const catalogUrl = new URL(runtime.catalogUrl, location.href);
  if (
    url.protocol === 'http:' &&
    loopbackHosts.includes(url.hostname) &&
    loopbackHosts.includes(catalogUrl.hostname)
  )
    return;

  if (url.protocol !== 'https:')
    throw new Error('Published host URL must use HTTPS.');

  const allowed = new Set([
    catalogUrl.origin,
    ...(runtime.assetOrigins || []).map((value) => new URL(value).origin),
    ...(runtime.externalRegistryUrls || []).map(
      (value) => new URL(value).origin,
    ),
  ]);

  if (!allowed.has(url.origin))
    throw new Error(
      'Selected host URL uses an origin not approved by bootstrap assetOrigins.',
    );
}
