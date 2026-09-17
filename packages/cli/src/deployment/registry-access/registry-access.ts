import {
  assertEnvironmentDeployment,
  assertPublishedArtifactManifest,
  type AtlasEnvironmentDeployment,
  type AtlasManifestDescriptor,
  type AtlasPublishedArtifactManifest,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { assertStaticRegistry } from '../../publication/index.js';
import { sha256Digest } from '../../shared/index.js';
import type { RegistryAccess } from '../types.js';

export function environmentStatePath(environment: string): string {
  return `environments/${environment}/deployment.json`;
}

export function hostManifestPath({
  environment,
  hostId,
}: {
  environment: string;
  hostId: string;
}): string {
  return `environments/${environment}/hosts/${hostId}/manifest.json`;
}

export async function sourceRegistry(
  access: RegistryAccess,
): Promise<AtlasStaticRegistry> {
  const registry = await sourceJson({ access, path: 'registry.json' });
  if (!registry) throw new Error('Source registry.json is missing.');

  assertStaticRegistry(registry);

  return registry;
}

export async function sourceEnvironmentState({
  access,
  environment,
}: {
  access: RegistryAccess;
  environment: string;
}): Promise<AtlasEnvironmentDeployment | undefined> {
  const value = await sourceJson({
    access,
    path: environmentStatePath(environment),
  });

  return parseEnvironmentState({ value, environment, registry: 'source' });
}

export async function targetEnvironmentState({
  access,
  environment,
}: {
  access: RegistryAccess;
  environment: string;
}): Promise<AtlasEnvironmentDeployment | undefined> {
  const path = environmentStatePath(environment);
  const bytes = await access.storage.read(path);
  const value = bytes
    ? parseJsonBytes({ bytes, subject: `target ${path}` })
    : undefined;

  return parseEnvironmentState({ value, environment, registry: 'target' });
}

export async function publishedManifest({
  access,
  descriptor,
}: {
  access: RegistryAccess;
  descriptor: AtlasManifestDescriptor;
}): Promise<AtlasPublishedArtifactManifest> {
  const bytes = await sourceBytes({ access, path: descriptor.path });

  if (
    !bytes ||
    bytes.byteLength !== descriptor.size ||
    sha256Digest(bytes) !== descriptor.digest
  )
    throw new Error(
      `Atlas artifact descriptor ${descriptor.path} failed integrity verification.`,
    );

  const manifest = parseJsonBytes({
    bytes,
    subject: `artifact descriptor ${descriptor.path}`,
  });
  assertPublishedArtifactManifest(manifest);

  return manifest;
}

function parseEnvironmentState({
  value,
  environment,
  registry,
}: {
  value: unknown;
  environment: string;
  registry: 'source' | 'target';
}): AtlasEnvironmentDeployment | undefined {
  if (value === undefined) return undefined;

  try {
    assertEnvironmentDeployment(value);
  } catch (error) {
    throw new Error(
      `Atlas ${registry} environment "${environment}" deployment state is invalid.`,
      { cause: error },
    );
  }

  if (value.environment !== environment)
    throw new Error(
      `Atlas ${registry} environment deployment state must match "${environment}".`,
    );

  return value;
}

async function sourceJson({
  access,
  path,
}: {
  access: RegistryAccess;
  path: string;
}): Promise<unknown> {
  const bytes = await sourceBytes({ access, path });

  return bytes
    ? parseJsonBytes({ bytes, subject: `source ${path}` })
    : undefined;
}

async function sourceBytes({
  access: { storage, locations },
  path,
}: {
  access: RegistryAccess;
  path: string;
}): Promise<Uint8Array | undefined> {
  if (locations.source === locations.target) return storage.read(path);

  const response = await fetch(new URL(path, `${locations.source}/`));
  if (response.status === 404) return undefined;

  if (!response.ok)
    throw Object.assign(
      new Error(`Atlas source returned HTTP ${response.status} for ${path}.`),
      { status: response.status },
    );

  return new Uint8Array(await response.arrayBuffer());
}

function parseJsonBytes({
  bytes,
  subject,
}: {
  bytes: Uint8Array;
  subject: string;
}): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`Atlas ${subject} contains invalid JSON.`, {
      cause: error,
    });
  }
}
