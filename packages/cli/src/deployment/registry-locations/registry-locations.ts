import {
  CliArguments,
  isSecureOrLoopbackUrl,
  trimTrailingSlash,
} from '../../shared/index.js';
import type { RegistryLocations } from '../types.js';

export function registryLocations(args: CliArguments): RegistryLocations {
  const shorthand = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  const source =
    args.flag('source-registry-url') ?? process.env.ATLAS_SOURCE_REGISTRY_URL;
  const target =
    args.flag('target-registry-url') ?? process.env.ATLAS_TARGET_REGISTRY_URL;

  if (shorthand && (source || target))
    throw new Error(
      '--registry-url cannot be combined with --source-registry-url or --target-registry-url.',
    );
  if (Boolean(source) !== Boolean(target))
    throw new Error(
      '--source-registry-url and --target-registry-url must be supplied together.',
    );

  if (shorthand) {
    const registryUrl = registryRoot({
      value: shorthand,
      flag: '--registry-url',
    });

    return { source: registryUrl, target: registryUrl };
  }

  if (source && target)
    return {
      source: registryRoot({ value: source, flag: '--source-registry-url' }),
      target: registryRoot({ value: target, flag: '--target-registry-url' }),
    };

  throw new Error(
    'Atlas deploy requires --registry-url, or both --source-registry-url and --target-registry-url.',
  );
}

function registryRoot({
  value,
  flag,
}: {
  value: string;
  flag: string;
}): string {
  if (value === 'true') throw new Error(`${flag} requires a URL.`);

  const url = new URL(value);
  if (!isSecureOrLoopbackUrl(url))
    throw new Error(`${flag} must use HTTPS except for loopback development.`);
  if (url.search || url.hash || url.username || url.password)
    throw new Error(`${flag} must be a registry root URL.`);

  return trimTrailingSlash(url.href);
}
