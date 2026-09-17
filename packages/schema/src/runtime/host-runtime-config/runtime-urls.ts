import type { AtlasHostRuntimeConfig } from '../atlas-host-runtime-config.js';

export const ATLAS_RUNTIME_CONFIG_PATH = '/atlas.runtime.json';

export function resolveEnvironmentRegistryUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return runtime.environmentRegistryUrl ?? runtime.artifactRegistryUrl;
}

export function buildEnvironmentManifestUrl(
  runtime: AtlasHostRuntimeConfig,
): string {
  return new URL(
    `environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
    `${resolveEnvironmentRegistryUrl(runtime)}/`,
  ).href;
}

export function buildArtifactUrl(
  runtime: AtlasHostRuntimeConfig,
  path: string,
): string {
  return new URL(path, `${runtime.artifactRegistryUrl}/`).href;
}
