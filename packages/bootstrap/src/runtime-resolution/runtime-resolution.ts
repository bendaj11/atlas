import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import type { AtlasBootstrapManifest } from '../bootstrap/bootstrap-manifest.js';
import {
  atlasHostDiscoveryUrl,
  resolveHostDiscovery,
} from '../host-discovery/host-discovery.js';

export interface AtlasDiscoveryRequest {
  readonly url: string;
  readonly runtime: AtlasHostRuntimeConfig;
}

export function atlasDiscoveryRequest(
  bootstrap: AtlasBootstrapManifest,
): AtlasDiscoveryRequest | undefined {
  if (bootstrap.developmentRuntime) return undefined;
  const url = atlasHostDiscoveryUrl(bootstrap.registryUrl, bootstrap.hostId);
  return {
    url,
    runtime: {
      schemaVersion: '1',
      hostId: bootstrap.hostId,
      environment: 'discovery',
      manifestUrl: url,
      registryUrl: bootstrap.registryUrl,
      resourcesTimeoutMs: bootstrap.resourcesTimeoutMs,
      resourcesRetryCount: bootstrap.resourcesRetryCount,
      ...(bootstrap.assetOrigins
        ? { assetOrigins: [...bootstrap.assetOrigins] }
        : {}),
    },
  };
}

export function resolveAtlasHostRuntime(
  bootstrap: AtlasBootstrapManifest,
  discovery: unknown,
  currentUrl: string,
): AtlasHostRuntimeConfig {
  if (bootstrap.developmentRuntime) return bootstrap.developmentRuntime;
  const request = atlasDiscoveryRequest(bootstrap);
  if (!request) {
    throw new Error('Atlas bootstrap discovery request is unavailable.');
  }
  const binding = resolveHostDiscovery(discovery, bootstrap.hostId, currentUrl);
  return {
    ...request.runtime,
    environment: binding.environment,
    manifestUrl: binding.manifestUrl,
    ...(binding.externalRegistries
      ? { externalRegistries: binding.externalRegistries }
      : {}),
  };
}
