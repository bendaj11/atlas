import { type CliArguments, trimTrailingSlash } from '../../shared/index.js';

export function resolveRegistryUrl(args: CliArguments): string | undefined {
  const value = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;

  return value ? trimTrailingSlash(value) : undefined;
}
