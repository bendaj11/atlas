import type { AtlasStaticRegistry } from '@atlas/schema';
import type {
  AtlasPublicationLease,
  AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';
import type { AtlasRegistryConfig } from '../registry-config.js';
import {
  canonicalJson,
  registryRevision,
} from '../static-registry/revision/registry-revision.js';
import { assertStaticRegistry } from '../static-registry/validation/static-registry-validation.js';
import {
  type CliArguments,
  sha256Digest,
  isSecureOrLoopbackUrl,
  trimTrailingSlash,
  MUTABLE_CACHE_CONTROL,
} from '../../shared/index.js';

export const REGISTRY_PATH = 'registry.json';

export interface RegistryState {
  registry: AtlasStaticRegistry | undefined;
  versionToken?: string;
}

export async function readRegistry(
  storage: AtlasPublicationStorage,
): Promise<AtlasStaticRegistry | undefined> {
  const bytes = await storage.read(REGISTRY_PATH);
  if (!bytes) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error('Atlas registry.json is not valid JSON.', { cause: error });
  }
  assertStaticRegistry(value);

  return value;
}

export async function readRegistryState(
  storage: AtlasPublicationStorage,
): Promise<RegistryState> {
  const before = await storage.inspect(REGISTRY_PATH);
  const registry = await readRegistry(storage);
  const after = await storage.inspect(REGISTRY_PATH);
  if (before?.versionToken !== after?.versionToken) {
    throw new Error(
      'Atlas registry.json changed while it was being read. Retry the operation.',
    );
  }

  return {
    registry,
    ...(after?.versionToken ? { versionToken: after.versionToken } : {}),
  };
}

export async function writeRegistry(options: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  registry: AtlasStaticRegistry;
  versionToken?: string;
}): Promise<void> {
  const { storage, lease, registry, versionToken } = options;
  await lease.assertHeld();
  const bytes = new TextEncoder().encode(`${canonicalJson(registry)}\n`);
  await storage.replace(
    REGISTRY_PATH,
    bytes,
    { cacheControl: MUTABLE_CACHE_CONTROL, contentType: 'application/json' },
    versionToken ? { versionToken } : { createOnly: true },
  );
  const stored = await storage.read(REGISTRY_PATH);
  if (!stored || sha256Digest(stored) !== sha256Digest(bytes)) {
    throw new Error('Atlas could not verify registry.json after write.');
  }
}

export function assertExpectedRegistryRevision(
  args: CliArguments,
  current: AtlasStaticRegistry | undefined,
): void {
  const expected = args.flag('expected-registry-revision');
  if (expected && expected !== registryRevision(current)) {
    throw new Error(
      `Registry revision conflict: expected ${expected}, found ${registryRevision(current)}.`,
    );
  }
}

export async function verifyPublicRegistry(options: {
  args: CliArguments;
  config: AtlasRegistryConfig | undefined;
  expected: AtlasStaticRegistry;
  fetchResource?: typeof fetch;
}): Promise<void> {
  const { args, config, expected, fetchResource = fetch } = options;
  if (config?.verifyRegistry) {
    await config.verifyRegistry(expected);

    return;
  }
  const root = publicRegistryRoot(args);
  const response = await fetchResource(new URL(REGISTRY_PATH, `${root}/`), {
    cache: 'no-store',
    redirect: 'manual',
  });
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    throw new Error(
      `Atlas could not verify public registry.json: HTTP ${response.status}.`,
    );
  }
  const value: unknown = await response.json();
  assertStaticRegistry(value);
  if (value.revision !== expected.revision) {
    throw new Error(
      `Public registry revision ${value.revision} does not match published revision ${expected.revision}.`,
    );
  }
}

export function assertPublicRegistryConfigured(
  args: CliArguments,
  config: AtlasRegistryConfig | undefined,
): void {
  if (!config?.verifyRegistry) publicRegistryRoot(args);
}

export function publicRegistryRoot(args: CliArguments): string {
  const value = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  if (!value || value === 'true') {
    throw new Error('--registry-url or ATLAS_REGISTRY_URL is required.');
  }
  const url = new URL(value);
  if (!isSecureOrLoopbackUrl(url)) {
    throw new Error(
      'Atlas public registry URL must use HTTPS outside loopback.',
    );
  }
  if (url.pathname.endsWith(`/${REGISTRY_PATH}`)) {
    url.pathname = url.pathname.slice(0, -REGISTRY_PATH.length);
  }

  return trimTrailingSlash(url.href);
}
