import type {
  AtlasConfig,
  AtlasHostConfig,
  AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';

const DEFAULT_LOCAL_REGISTRY_URL = 'http://localhost:4400';

export function createHostRuntimeConfig(
  config: AtlasConfig,
  args = new CliArguments([]),
  _hostVersion?: string,
): AtlasHostRuntimeConfig {
  assertHostConfig(config);
  const artifactRegistryUrl = resolveRegistryUrl(args) ?? DEFAULT_LOCAL_REGISTRY_URL;
  const environment = resolveRuntimeEnvironment(args, artifactRegistryUrl);
  const environmentRegistryUrl = resolveEnvironmentRegistryUrl(args);
  return {
    schemaVersion: 'v1',
    hostId: config.id,
    environment,
    artifactRegistryUrl,
    ...(environmentRegistryUrl ? { environmentRegistryUrl } : {}),
  };
}

function resolveRuntimeEnvironment(
  args: CliArguments,
  registryUrl: string,
): string {
  const value = args.flag('environment') ?? process.env.ATLAS_ENVIRONMENT;
  if (value) {
    assertSafeEnvironment(value);
    return value;
  }
  if (isLoopbackUrl(new URL(registryUrl))) return 'development';
  throw new Error(
    '--environment or ATLAS_ENVIRONMENT is required for a deployed host runtime.',
  );
}

function assertSafeEnvironment(value: string): void {
  if (value === 'latest' || !/^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(value)) {
    throw new Error(
      `Atlas environment "${value}" must be a URL-safe path segment; "latest" is reserved.`,
    );
  }
}

export function resolveRegistryUrl(args: CliArguments): string | undefined {
  const value = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  return value ? trimSlash(value) : undefined;
}

function resolveEnvironmentRegistryUrl(args: CliArguments): string | undefined {
  const value = args.flag('environment-registry-url') ?? process.env.ATLAS_ENVIRONMENT_REGISTRY_URL;
  return value ? trimSlash(value) : undefined;
}

function isLoopbackUrl(url: URL): boolean {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  );
}

function assertHostConfig(
  config: AtlasConfig,
): asserts config is AtlasHostConfig {
  if (
    config.type === 'app' ||
    'routes' in config ||
    'slots' in config ||
    'domIsolation' in config ||
    'requiredHostSdkVersion' in config
  ) {
    throw new Error(
      `Atlas bootstrap build expects a host config for "${config.id}", but received an app config.`,
    );
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}
