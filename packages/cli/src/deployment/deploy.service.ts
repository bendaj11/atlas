import { createHash } from 'node:crypto';
import type {
  AtlasAppArtifactManifest,
  AtlasEnvironmentDeployment,
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  assertEnvironmentDeployment,
  assertPublishedArtifactManifest,
  placementTargetsHost,
} from '@atlas/schema';
import { CliArguments } from '../cli/arguments.js';
import {
  createPublicationStorage,
  type AtlasPublicationLease,
  type AtlasPublicationStorage,
} from '../publication/publication-storage/publication-storage.js';
import type { AtlasRegistryConfig } from '../publication/registry-config.js';
import {
  assertEnvironmentName,
  assertStaticRegistry,
  canonicalJson,
  resolveRegistryArtifact,
} from '../publication/static-registry/static-registry.js';

const MUTABLE_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

export interface AtlasDeployResult {
  artifactId: string;
  environment: string;
  version: string;
  registryRevision: string;
  convergedHosts: string[];
  pendingHosts: string[];
  dryRun: boolean;
}

interface RegistryLocations {
  source: string;
  target: string;
}

interface Selection {
  kind: 'app' | 'host';
  id: string;
  version: string;
}

interface DeploymentWrite {
  state: AtlasEnvironmentDeployment;
  manifests: AtlasHostDeploymentManifest[];
}

export class AtlasDeployService {
  constructor(private readonly args: CliArguments) {}

  async run(
    artifactIdentifier: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasDeployResult> {
    const environment = requiredFlag(this.args, 'to');
    const selector = requiredFlag(this.args, 'version');
    assertEnvironmentName(environment);

    const locations = registryLocations(this.args);
    const storage = await createPublicationStorage(config?.storage, this.args);
    const registry = await sourceRegistry(storage, locations);
    const selected = await selection(
      storage,
      locations,
      registry,
      artifactIdentifier,
      selector,
    );
    const dryRun = this.args.hasFlag('dry-run');
    const deployment = dryRun
      ? await prepareDeployment(
          storage,
          locations,
          registry,
          environment,
          selected,
        )
      : await withLease(storage, async (lease) => {
          const prepared = await prepareDeployment(
            storage,
            locations,
            registry,
            environment,
            selected,
          );
          await writeDeployment(storage, lease, environment, prepared);
          return prepared;
        });

    if (!dryRun) {
      await config?.invalidate?.([
        envPath(environment),
        ...deployment.manifests.map((manifest) =>
          hostPath(environment, manifest.hostId),
        ),
      ]);
    }

    return {
      artifactId: selected.id,
      environment,
      version: selected.version,
      registryRevision: deployment.state.revision,
      convergedHosts: deployment.manifests.map((manifest) => manifest.hostId),
      pendingHosts: [],
      dryRun,
    };
  }
}

function registryLocations(args: CliArguments): RegistryLocations {
  const shorthand = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  const source =
    args.flag('source-registry-url') ?? process.env.ATLAS_SOURCE_REGISTRY_URL;
  const target =
    args.flag('target-registry-url') ?? process.env.ATLAS_TARGET_REGISTRY_URL;
  if (shorthand && (source || target)) {
    throw new Error(
      '--registry-url cannot be combined with --source-registry-url or --target-registry-url.',
    );
  }
  if (Boolean(source) !== Boolean(target)) {
    throw new Error(
      '--source-registry-url and --target-registry-url must be supplied together.',
    );
  }
  if (shorthand) {
    const registryUrl = root(shorthand, '--registry-url');
    return { source: registryUrl, target: registryUrl };
  }
  if (source && target) {
    return {
      source: root(source, '--source-registry-url'),
      target: root(target, '--target-registry-url'),
    };
  }
  throw new Error(
    'Atlas deploy requires --registry-url, or both --source-registry-url and --target-registry-url.',
  );
}

async function selection(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  registry: AtlasStaticRegistry,
  identifier: string,
  selector: string,
): Promise<Selection> {
  const resolved = resolveRegistryArtifact(registry, identifier);
  const artifact = resolved.artifact;
  const version =
    selector === 'latest'
      ? artifact.latest
      : artifact.releases[selector]
        ? selector
        : await sourceEnvironmentVersion(
            storage,
            locations,
            selector,
            resolved.kind,
            artifact.id,
          );
  const descriptor = version ? artifact.releases[version] : undefined;
  if (!version || !descriptor) {
    throw new Error(
      `Atlas selector "${selector}" is neither an exact release, latest, nor a source environment selection for "${identifier}".`,
    );
  }
  return { kind: resolved.kind, id: artifact.id, version };
}

async function sourceEnvironmentVersion(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  environment: string,
  kind: 'app' | 'host',
  id: string,
): Promise<string | undefined> {
  assertEnvironmentName(environment);
  const deployment = await sourceEnvironmentState(
    storage,
    locations,
    environment,
  );
  return deployment?.[kind === 'app' ? 'apps' : 'hosts'][id]?.version;
}

async function prepareDeployment(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  registry: AtlasStaticRegistry,
  environment: string,
  selected: Selection,
): Promise<DeploymentWrite> {
  const state = select(
    await targetEnvironmentState(storage, environment),
    environment,
    selected,
  );
  const manifests = await hostManifests(
    storage,
    locations,
    registry,
    state,
    selected,
  );
  return { state, manifests };
}

function select(
  current: AtlasEnvironmentDeployment | undefined,
  environment: string,
  selected: Selection,
): AtlasEnvironmentDeployment {
  const content = {
    schemaVersion: 'v1' as const,
    environment,
    hosts: { ...(current?.hosts ?? {}) },
    apps: { ...(current?.apps ?? {}) },
  };
  content[selected.kind === 'app' ? 'apps' : 'hosts'][selected.id] = {
    version: selected.version,
  };
  return {
    ...content,
    updatedAt: new Date().toISOString(),
    revision: revision(content),
  };
}

async function hostManifests(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  registry: AtlasStaticRegistry,
  state: AtlasEnvironmentDeployment,
  selected: Selection,
): Promise<AtlasHostDeploymentManifest[]> {
  const apps = await Promise.all(
    Object.entries(state.apps).map(async ([id, entry]) => {
      const descriptor = release(registry, 'app', id, entry.version);
      return {
        id,
        descriptor,
        manifest: (await publishedManifest(
          storage,
          locations,
          descriptor,
        )) as AtlasAppArtifactManifest,
      };
    }),
  );
  const hostIds =
    selected.kind === 'host'
      ? [selected.id]
      : Object.keys(state.hosts).filter((id) =>
          apps.some((app) =>
            app.manifest.placements.some((placement) =>
              placementTargetsHost(placement, id),
            ),
          ),
        );
  return hostIds.sort().map((hostId) => {
    const host = state.hosts[hostId];
    if (!host)
      throw new Error(
        `Atlas host "${hostId}" is not selected in environment "${state.environment}".`,
      );
    const appsForHost = apps
      .filter((app) =>
        app.manifest.placements.some((placement) =>
          placementTargetsHost(placement, hostId),
        ),
      )
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((app) => app.descriptor);
    const content = {
      hostId,
      environment: state.environment,
      host: release(registry, 'host', hostId, host.version),
      apps: appsForHost,
    };
    return {
      schemaVersion: 'v1' as const,
      kind: 'host-deployment' as const,
      ...content,
      deploymentRevision: revision(content),
    };
  });
}

function release(
  registry: AtlasStaticRegistry,
  kind: 'app' | 'host',
  id: string,
  version: string,
): AtlasManifestDescriptor {
  const descriptor = (kind === 'app' ? registry.apps : registry.hosts)[id]
    ?.releases[version];
  if (!descriptor)
    throw new Error(
      `Atlas ${kind} "${id}" release "${version}" is missing from source artifact registry.`,
    );
  return descriptor;
}

async function sourceRegistry(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
): Promise<AtlasStaticRegistry> {
  const registry = await sourceJson(storage, locations, 'registry.json');
  if (!registry) throw new Error('Source registry.json is missing.');
  assertStaticRegistry(registry);
  return registry;
}

async function targetEnvironmentState(
  storage: AtlasPublicationStorage,
  environment: string,
): Promise<AtlasEnvironmentDeployment | undefined> {
  return parseEnvironmentState(
    await storageJson(storage, envPath(environment)),
    environment,
    'target',
  );
}

async function sourceEnvironmentState(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  environment: string,
): Promise<AtlasEnvironmentDeployment | undefined> {
  return parseEnvironmentState(
    await sourceJson(storage, locations, envPath(environment)),
    environment,
    'source',
  );
}

function parseEnvironmentState(
  value: unknown,
  environment: string,
  registry: 'source' | 'target',
): AtlasEnvironmentDeployment | undefined {
  if (value === undefined) return undefined;
  try {
    assertEnvironmentDeployment(value);
  } catch (error) {
    throw new Error(
      `Atlas ${registry} environment "${environment}" deployment state is invalid: ${message(error)}`,
    );
  }
  if (value.environment !== environment) {
    throw new Error(
      `Atlas ${registry} environment deployment state must match "${environment}".`,
    );
  }
  return value;
}

async function storageJson(
  storage: AtlasPublicationStorage,
  path: string,
): Promise<unknown | undefined> {
  const bytes = await storage.read(path);
  return bytes ? parseJson(bytes, `target ${path}`) : undefined;
}

async function sourceJson(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  path: string,
): Promise<unknown | undefined> {
  const bytes = await sourceBytes(storage, locations, path);
  return bytes ? parseJson(bytes, `source ${path}`) : undefined;
}

function parseJson(bytes: Uint8Array, subject: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(
      `Atlas ${subject} contains invalid JSON: ${message(error)}`,
    );
  }
}

async function publishedManifest(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  descriptor: AtlasManifestDescriptor,
): Promise<AtlasPublishedArtifactManifest> {
  const bytes = await sourceBytes(storage, locations, descriptor.path);
  if (
    !bytes ||
    bytes.byteLength !== descriptor.size ||
    digest(bytes) !== descriptor.digest
  ) {
    throw new Error(
      `Atlas artifact descriptor ${descriptor.path} failed integrity verification.`,
    );
  }
  const manifest = parseJson(bytes, `artifact descriptor ${descriptor.path}`);
  assertPublishedArtifactManifest(manifest);
  return manifest;
}

async function sourceBytes(
  storage: AtlasPublicationStorage,
  locations: RegistryLocations,
  path: string,
): Promise<Uint8Array | undefined> {
  if (locations.source === locations.target) return storage.read(path);
  const response = await fetch(new URL(path, `${locations.source}/`));
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(
      `Atlas source returned HTTP ${response.status} for ${path}.`,
    );
  return new Uint8Array(await response.arrayBuffer());
}

async function writeDeployment(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  environment: string,
  deployment: DeploymentWrite,
): Promise<void> {
  await writeJson(storage, lease, envPath(environment), deployment.state);
  for (const manifest of deployment.manifests) {
    await writeJson(
      storage,
      lease,
      hostPath(environment, manifest.hostId),
      manifest,
    );
  }
}

async function writeJson(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  path: string,
  value: unknown,
): Promise<void> {
  await lease.assertHeld();
  const bytes = new TextEncoder().encode(`${canonicalJson(value)}\n`);
  const previous = await storage.inspect(path);
  await storage.replace(
    path,
    bytes,
    { cacheControl: MUTABLE_CACHE_CONTROL, contentType: 'application/json' },
    previous?.versionToken
      ? { versionToken: previous.versionToken }
      : { createOnly: true },
  );
}

async function withLease<T>(
  storage: AtlasPublicationStorage,
  operation: (lease: AtlasPublicationLease) => Promise<T>,
): Promise<T> {
  const lease = await storage.acquireLock(`atlas:${process.pid}:${Date.now()}`);
  try {
    return await operation(lease);
  } finally {
    await lease.release();
  }
}

function envPath(environment: string): string {
  return `environments/${environment}/deployment.json`;
}
function hostPath(environment: string, id: string): string {
  return `environments/${environment}/hosts/${id}/manifest.json`;
}
function revision(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}
function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
function requiredFlag(args: CliArguments, name: string): string {
  const value = args.flag(name);
  if (!value || value === 'true') throw new Error(`--${name} is required.`);
  return value;
}
function root(value: string, flag: string): string {
  if (value === 'true') throw new Error(`${flag} requires a URL.`);
  const url = new URL(value);
  if (!isSecureRegistryProtocol(url))
    throw new Error(`${flag} must use HTTPS except for loopback development.`);
  if (url.search || url.hash || url.username || url.password)
    throw new Error(`${flag} must be a registry root URL.`);
  return url.href.replace(/\/+$/u, '');
}
function isSecureRegistryProtocol(url: URL): boolean {
  return (
    url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url))
  );
}
function isLoopback(url: URL): boolean {
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]'
  );
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
