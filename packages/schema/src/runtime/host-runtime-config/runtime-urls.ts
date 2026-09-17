import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';

export const ATLAS_RUNTIME_CONFIG_PATH = '/atlas.runtime.json';

export function environmentRegistryUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return runtime.environmentRegistryUrl ?? runtime.artifactRegistryUrl;
}

export function environmentManifestUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return new URL(
    `environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
    `${environmentRegistryUrl(runtime)}/`,
  ).href;
}

export function artifactUrl(
  runtime: AtlasHostRuntimeConfig,
  path: string,
): string {
  return new URL(path, `${runtime.artifactRegistryUrl}/`).href;
}
