import type { HostDevPorts } from '../types.js';
import { resolveHostDevPorts } from './ports.js';
import { CliArguments } from '../../shared/index.js';

export class DevelopmentPortsDriver {
  private flags: string[] = [];
  private configuredPort = 4200;
  private previewKind: 'deployed' | 'local' = 'local';

  readonly given = {
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    configuredPort: (configuredPort: number): this => {
      this.configuredPort = configuredPort;

      return this;
    },
    previewKind: (previewKind: 'deployed' | 'local'): this => {
      this.previewKind = previewKind;

      return this;
    },
  };

  readonly get = {
    ports: (): HostDevPorts =>
      resolveHostDevPorts({
        args: new CliArguments(['dev', 'shell', ...this.flags]),
        configuredPort: this.configuredPort,
        previewKind: this.previewKind,
      }),
  };
}
