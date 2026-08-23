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
  hostVersion?: string,
): AtlasHostRuntimeConfig {
  assertHostConfig(config);
  const registryUrl = resolveRegistryUrl(args) ?? DEFAULT_LOCAL_REGISTRY_URL;
  const environment = resolveRuntimeEnvironment(args, registryUrl);
  return {
    schemaVersion: '1',
    hostId: config.id,
    ...(hostVersion ? { hostVersion } : {}),
    manifestUrl: `${registryUrl}/environments/${environment}/hosts/${config.id}/manifest.json`,
    environment,
    registryUrl,
    resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15000,
    resourcesRetryCount: config.resourcesRetryCount ?? 3,
    ...optionalUrlList('asset-origins', args.flag('asset-origins')),
    ...optionalExternalRegistries(args.flag('external-registries')),
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

function optionalUrlList(
  kind: 'asset-origins',
  value: string | undefined,
): Pick<AtlasHostRuntimeConfig, 'assetOrigins'> {
  if (!value) return {};
  const urls = [
    ...new Set(
      value
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((entry) => {
          const url = new URL(entry);
          if (url.protocol !== 'https:' && !isLoopbackUrl(url)) {
            throw new Error(
              `--${kind} must contain HTTPS URLs or loopback URLs for local development.`,
            );
          }
          return url.origin;
        }),
    ),
  ];
  return { assetOrigins: urls };
}

function optionalExternalRegistries(
  value: string | undefined,
): Pick<AtlasHostRuntimeConfig, 'externalRegistries'> {
  if (!value) return {};
  return {
    externalRegistries: value
      .split(',')
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.lastIndexOf('|');
        if (separator < 1 || separator === entry.length - 1) {
          throw new Error(
            '--external-registries entries must use <registry-url>|<environment>.',
          );
        }
        const registryUrl = entry.slice(0, separator).replace(/\/$/, '');
        const environment = entry.slice(separator + 1);
        const url = new URL(registryUrl);
        if (url.protocol !== 'https:' && !isLoopbackUrl(url)) {
          throw new Error(
            '--external-registries requires HTTPS outside loopback.',
          );
        }
        return { registryUrl, environment };
      }),
  };
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
