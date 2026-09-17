import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import { assertRuntimeConfigFields } from './assert-runtime-config-fields.js';
import { assertRegistryUrl, resolveRegistryUrl } from './registry-url.js';
import { ATLAS_RUNTIME_CONFIG_PATH } from './runtime-config.constants.js';

export function assertAtlasRuntimeConfig(
  value: unknown,
): asserts value is AtlasHostRuntimeConfig {
  assertRuntimeConfigFields(value);

  assertRegistryUrl({
    value: value.artifactRegistryUrl,
    field: 'artifactRegistryUrl',
  });

  if (value.environmentRegistryUrl !== undefined) {
    assertRegistryUrl({
      value: value.environmentRegistryUrl,
      field: 'environmentRegistryUrl',
    });
  }
}

export function resolveAtlasRuntimeConfig(
  value: unknown,
  hostUrl?: string,
): AtlasHostRuntimeConfig {
  assertRuntimeConfigFields(value);

  const runtimeConfigUrl = hostUrl
    ? new URL(ATLAS_RUNTIME_CONFIG_PATH, hostUrl)
    : undefined;
  const artifactRegistryUrl = resolveRegistryUrl({
    value: value.artifactRegistryUrl,
    runtimeConfigUrl,
    field: 'artifactRegistryUrl',
  });

  if (value.environmentRegistryUrl === undefined) {
    return { ...value, artifactRegistryUrl };
  }

  return {
    ...value,
    artifactRegistryUrl,
    environmentRegistryUrl: resolveRegistryUrl({
      value: value.environmentRegistryUrl,
      runtimeConfigUrl,
      field: 'environmentRegistryUrl',
    }),
  };
}
