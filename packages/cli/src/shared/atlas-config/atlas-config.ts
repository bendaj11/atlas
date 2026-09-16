import type {
  AtlasAppConfig,
  AtlasConfig,
  AtlasHostConfig,
} from '@atlas/schema';

export function isHostConfig(config: AtlasConfig): config is AtlasHostConfig {
  if (config.type) return config.type === 'host';

  return 'resourcesTimeoutMs' in config || 'resourcesRetryCount' in config;
}

export function assertAppConfig(config: AtlasConfig): AtlasAppConfig {
  if (isHostConfig(config)) {
    throw new Error(
      `Atlas build expects an app config for "${config.id}", but received a host config.`,
    );
  }

  return config;
}
