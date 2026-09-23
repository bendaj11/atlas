import { resolveHostDevPorts } from './ports.js';
import { CliArguments } from '../../shared/index.js';

export class DevelopmentPortsDriver {
  private flags: string[] = [];
  private configuredPort = 4200;
  private previewKind: 'deployed' | 'local' = 'local';

  readonly given = {
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    configuredPort: (configuredPort: number) => {
      this.configuredPort = configuredPort;

      return this;
    },
    previewKind: (previewKind: 'deployed' | 'local') => {
      this.previewKind = previewKind;

      return this;
    },
  };

  readonly get = {
    ports: () =>
      resolveHostDevPorts({
        args: new CliArguments(['dev', 'shell', ...this.flags]),
        configuredPort: this.configuredPort,
        previewKind: this.previewKind,
      }),
  };
}
