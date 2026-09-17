import type { AtlasProjectType } from '../types/generator-types.js';
import {
  getDefaultDevServerPort,
  deriveHostClientPortFromBootstrapPort,
} from './ports.js';

export class PortsDriver {
  private port!: number;

  readonly when = {
    defaultPortResolved: (type: AtlasProjectType) => {
      this.port = getDefaultDevServerPort(type);
    },
    hostClientPortResolved: (bootstrapPort: number) => {
      this.port = deriveHostClientPortFromBootstrapPort(bootstrapPort);
    },
  };

  readonly get = {
    port: () => this.port,
  };
}
