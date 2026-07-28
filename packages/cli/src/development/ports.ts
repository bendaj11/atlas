import { CliArguments } from '../cli/arguments.js';
import {
  DEFAULT_HOST_BOOTSTRAP_PORT,
  DEFAULT_HOST_CLIENT_PORT,
} from './constants.js';
import type { HostDevPorts } from './types.js';

export function resolveHostDevPorts(
  args: CliArguments,
  configuredPort: number,
): HostDevPorts {
  const bootstrapPort = args.port('bootstrap-port', configuredPort);
  const clientPort = args.port(
    'host-client-port',
    hostClientPortFallback(args, configuredPort, bootstrapPort),
  );
  if (!args.hasFlag('host-url') && clientPort === bootstrapPort) {
    throw new Error(
      'Host bootstrap and host client ports must differ. Pass --host-client-port with another port.',
    );
  }
  return { bootstrapPort, clientPort };
}

function hostClientPortFallback(
  args: CliArguments,
  configuredPort: number,
  bootstrapPort: number,
): number {
  if (args.hasFlag('host-url') || args.hasFlag('bootstrap-port'))
    return configuredPort;
  return bootstrapPort === DEFAULT_HOST_CLIENT_PORT
    ? DEFAULT_HOST_BOOTSTRAP_PORT
    : DEFAULT_HOST_CLIENT_PORT;
}
