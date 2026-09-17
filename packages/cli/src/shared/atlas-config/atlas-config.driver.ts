import type { AtlasConfig } from '@atlas/schema';
import { assertAppConfig, isHostConfig } from './atlas-config.js';

export class AtlasConfigDriver {
  private config!: AtlasConfig;

  readonly given = {
    config: (config: AtlasConfig) => {
      this.config = config;

      return this;
    },
  };

  readonly get = {
    isHost: () => isHostConfig(this.config),
    appConfig: () => assertAppConfig(this.config),
  };
}
