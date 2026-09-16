import type { AtlasProjectType } from '../types/generator-types.js';
import { defaultDevServerPort, hostClientPort } from './ports.js';

export class PortsDriver {
  private port!: number;

  readonly when = {
    defaultPortResolved: (type: AtlasProjectType): void => {
      this.port = defaultDevServerPort(type);
    },
    hostClientPortResolved: (bootstrapPort: number): void => {
      this.port = hostClientPort(bootstrapPort);
    },
  };

  readonly get = {
    port: (): number => this.port,
  };
}
