import { CliArguments } from '../../cli/arguments.js';
import {
  DEFAULT_HOST_BOOTSTRAP_PORT,
  DEFAULT_HOST_CLIENT_PORT,
} from '../constants.js';
import type { HostDevPorts } from '../types.js';

interface ResolveHostDevPortsOptions {
  args: CliArguments;
  configuredPort: number;
  previewKind: 'deployed' | 'local';
}

export function resolveHostDevPorts(
  options: ResolveHostDevPortsOptions,
): HostDevPorts {
  const { args, configuredPort, previewKind } = options;
  const bootstrapPort = args.port('bootstrap-port', configuredPort);
  const clientPort = args.port(
    'host-client-port',
    hostClientPortFallback({
      args,
      bootstrapPort,
      configuredPort,
      previewKind,
    }),
  );
  if (previewKind === 'local' && clientPort === bootstrapPort) {
    throw new Error(
      'Host bootstrap and host client ports must differ. Pass --host-client-port with another port.',
    );
  }
  return { bootstrapPort, clientPort };
}

function hostClientPortFallback(
  options: ResolveHostDevPortsOptions & { bootstrapPort: number },
): number {
  const { args, bootstrapPort, configuredPort, previewKind } = options;
  if (previewKind === 'deployed' || args.hasFlag('bootstrap-port'))
    return configuredPort;
  return bootstrapPort === DEFAULT_HOST_CLIENT_PORT
    ? DEFAULT_HOST_BOOTSTRAP_PORT
    : DEFAULT_HOST_CLIENT_PORT;
}
