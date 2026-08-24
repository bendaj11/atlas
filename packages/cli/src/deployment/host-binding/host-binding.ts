import {
  normalizeAtlasHostBaseUrl,
  normalizeAtlasRegistryRoot,
} from '@atlas/schema';
import type { CliArguments } from '../../cli/arguments.js';
import {
  assertEnvironmentName,
  bindHostDeployment,
  type AtlasRegistryMutation,
  type AtlasResolvedRelease,
} from '../../publication/static-registry/static-registry.js';

export interface AtlasHostBindingRequest {
  readonly baseUrls: readonly string[] | undefined;
  readonly externalRegistries:
    readonly { registryUrl: string; environment: string }[] | undefined;
}

interface BindSelectedHostOptions extends AtlasHostBindingRequest {
  readonly mutation: AtlasRegistryMutation;
  readonly environment: string;
  readonly selected: AtlasResolvedRelease;
}

export function readHostBindingRequest(
  args: CliArguments,
  artifactKind: AtlasResolvedRelease['kind'],
): AtlasHostBindingRequest {
  return {
    baseUrls: readHostBaseUrls(args, artifactKind),
    externalRegistries: readExternalRegistries(args, artifactKind),
  };
}

export function bindSelectedHost(
  options: BindSelectedHostOptions,
): AtlasRegistryMutation {
  const {
    mutation,
    environment,
    selected,
    baseUrls: requestedBaseUrls,
    externalRegistries: requestedExternalRegistries,
  } = options;
  if (selected.kind === 'app') return mutation;
  const existingSelection =
    mutation.registry.deployments[environment]?.hosts[selected.artifact.id];
  const baseUrls = requestedBaseUrls ?? existingSelection?.baseUrls;
  if (!baseUrls?.length) {
    throw new Error(
      `Host "${selected.artifact.name}" needs its public URL the first time it is deployed to "${environment}". Pass --host-url https://your-host.example.com.`,
    );
  }
  return bindHostDeployment(mutation.registry, {
    environment,
    hostId: selected.artifact.id,
    baseUrls,
    externalRegistries:
      requestedExternalRegistries ?? existingSelection?.externalRegistries,
  });
}

function readHostBaseUrls(
  args: CliArguments,
  artifactKind: AtlasResolvedRelease['kind'],
): string[] | undefined {
  if (artifactKind === 'app') {
    if (args.hasFlag('host-url')) {
      throw new Error('--host-url can only be used when deploying a host.');
    }
    return undefined;
  }
  const value = args.flag('host-url') ?? process.env.ATLAS_HOST_URL;
  if (!value) return undefined;
  if (value === 'true') throw new Error('--host-url requires a URL.');
  const baseUrls = value
    .split(/[\s,]+/u)
    .filter(Boolean)
    .map(normalizeAtlasHostBaseUrl);
  if (baseUrls.length === 0) throw new Error('--host-url requires a URL.');
  return [...new Set(baseUrls)].sort();
}

function readExternalRegistries(
  args: CliArguments,
  artifactKind: AtlasResolvedRelease['kind'],
): Array<{ registryUrl: string; environment: string }> | undefined {
  const value = args.flag('external-registries');
  if (!value) return undefined;
  if (artifactKind === 'app') {
    throw new Error(
      '--external-registries can only be used when deploying a host.',
    );
  }
  if (value === 'true') {
    throw new Error('--external-registries requires registry|environment.');
  }
  return value.split(',').map(parseExternalRegistry);
}

function parseExternalRegistry(entry: string): {
  registryUrl: string;
  environment: string;
} {
  const separator = entry.lastIndexOf('|');
  if (separator < 1 || separator === entry.length - 1) {
    throw new Error(
      '--external-registries entries must use <registry-url>|<environment>.',
    );
  }
  const registryUrl = normalizeAtlasRegistryRoot(entry.slice(0, separator));
  const environment = entry.slice(separator + 1);
  assertEnvironmentName(environment);
  return { registryUrl, environment };
}
