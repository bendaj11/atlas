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
import {
  CliArguments,
  cliError,
  sha256Digest,
  isSecureOrLoopbackUrl,
  trimTrailingSlash,
  MUTABLE_CACHE_CONTROL,
  withExponentialRetry,
} from '../shared/index.js';
import {
  verifyDeliveryWhileHeld,
  withPublicationLease,
  createPublicationStorage,
  type AtlasPublicationLease,
  type AtlasPublicationStorage,
  type AtlasRegistryConfig,
  assertEnvironmentName,
  assertStaticRegistry,
  canonicalJson,
  resolveRegistryArtifact,
} from '../publication/index.js';

export interface AtlasDeployResult {
  artifactId: string;
  environment: string;
  version: string;
  registryRevision: string;
  dryRun: boolean;
}

interface RegistryLocations {
  source: string;
  target: string;
}

interface RegistryAccess {
  storage: AtlasPublicationStorage;
  locations: RegistryLocations;
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
    return withExponentialRetry(() => this.runOnce(artifactIdentifier, config));
  }

  private async runOnce(
    artifactIdentifier: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasDeployResult> {
    const environment = requiredFlag(this.args, 'to');
    const selector = requiredFlag(this.args, 'version');
    assertEnvironmentName(environment);

    const storage = await createPublicationStorage(config?.storage, this.args);
    const access = { storage, locations: registryLocations(this.args) };
    const registry = await sourceRegistry(access);
    const selected = await selection({
      access,
      registry,
      identifier: artifactIdentifier,
      selector,
    });
    const dryRun = this.args.hasFlag('dry-run');
    const prepare = () =>
      prepareDeployment({ access, registry, environment, selected });
    const deployment = dryRun
      ? await prepare()
      : await withPublicationLease(storage, async (lease) => {
          const prepared = await prepare();
          await writeDeployment({ storage, lease, environment, prepared });
          if (storage.verifyDelivery) {
            const paths = deploymentPaths(environment, prepared);
            await config?.invalidate?.(paths);
            await verifyDeliveryWhileHeld({ storage, lease, paths });
          }

          return prepared;
        });
    if (!dryRun && !storage.verifyDelivery)
      await config?.invalidate?.(deploymentPaths(environment, deployment));

    return {
      artifactId: selected.id,
      environment,
      version: selected.version,
      registryRevision: deployment.state.revision,
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

async function selection(options: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  identifier: string;
  selector: string;
}): Promise<Selection> {
  const { access, registry, identifier, selector } = options;
  const resolved = resolveRegistryArtifact(registry, identifier);
  const artifact = resolved.artifact;
  const version =
    selector === 'latest'
      ? artifact.latest
      : artifact.releases[selector]
        ? selector
        : await sourceEnvironmentVersion({
            access,
            environment: selector,
            kind: resolved.kind,
            id: artifact.id,
          });
  const descriptor = version ? artifact.releases[version] : undefined;
  if (!version || !descriptor) {
    throw cliError(
      `Atlas selector "${selector}" is neither an exact release, latest, nor a source environment selection for "${identifier}".`,
      [
        `Pass --version <release> with a version published for "${identifier}".`,
        'Pass --version latest or the name of a source environment that selects this artifact.',
      ],
      { code: 'ATLAS_VERSION_SELECTOR_INVALID' },
    );
  }
  return { kind: resolved.kind, id: artifact.id, version };
}

async function sourceEnvironmentVersion(options: {
  access: RegistryAccess;
  environment: string;
  kind: 'app' | 'host';
  id: string;
}): Promise<string | undefined> {
  const { access, environment, kind, id } = options;
  assertEnvironmentName(environment);
  const deployment = await sourceEnvironmentState(access, environment);

  return deployment?.[kind === 'app' ? 'apps' : 'hosts'][id]?.version;
}

async function prepareDeployment(options: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  environment: string;
  selected: Selection;
}): Promise<DeploymentWrite> {
  const { access, registry, environment, selected } = options;
  const state = select(
    await targetEnvironmentState(access.storage, environment),
    environment,
    selected,
  );
  const manifests = await hostManifests({ access, registry, state, selected });

  return { state, manifests };
}

function deploymentPaths(
  environment: string,
  deployment: DeploymentWrite,
): string[] {
  return [
    envPath(environment),
    ...deployment.manifests.map((manifest) =>
      hostPath(environment, manifest.hostId),
    ),
  ];
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

async function hostManifests(options: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  state: AtlasEnvironmentDeployment;
  selected: Selection;
}): Promise<AtlasHostDeploymentManifest[]> {
  const { access, registry, state, selected } = options;
  const apps = await Promise.all(
    Object.entries(state.apps).map(async ([id, entry]) => {
      const descriptor = release({
        registry,
        kind: 'app',
        id,
        version: entry.version,
      });

      return {
        id,
        descriptor,
        manifest: (await publishedManifest(
          access,
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
      host: release({
        registry,
        kind: 'host',
        id: hostId,
        version: host.version,
      }),
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

function release(options: {
  registry: AtlasStaticRegistry;
  kind: 'app' | 'host';
  id: string;
  version: string;
}): AtlasManifestDescriptor {
  const { registry, kind, id, version } = options;
  const descriptor = (kind === 'app' ? registry.apps : registry.hosts)[id]
    ?.releases[version];
  if (!descriptor)
    throw new Error(
      `Atlas ${kind} "${id}" release "${version}" is missing from source artifact registry.`,
    );
  return descriptor;
}

async function sourceRegistry(
  access: RegistryAccess,
): Promise<AtlasStaticRegistry> {
  const registry = await sourceJson(access, 'registry.json');
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
  access: RegistryAccess,
  environment: string,
): Promise<AtlasEnvironmentDeployment | undefined> {
  return parseEnvironmentState(
    await sourceJson(access, envPath(environment)),
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
      `Atlas ${registry} environment "${environment}" deployment state is invalid.`,
      { cause: error },
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
  access: RegistryAccess,
  path: string,
): Promise<unknown | undefined> {
  const bytes = await sourceBytes(access, path);
  return bytes ? parseJson(bytes, `source ${path}`) : undefined;
}

function parseJson(bytes: Uint8Array, subject: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`Atlas ${subject} contains invalid JSON.`, {
      cause: error,
    });
  }
}

async function publishedManifest(
  access: RegistryAccess,
  descriptor: AtlasManifestDescriptor,
): Promise<AtlasPublishedArtifactManifest> {
  const bytes = await sourceBytes(access, descriptor.path);
  if (
    !bytes ||
    bytes.byteLength !== descriptor.size ||
    sha256Digest(bytes) !== descriptor.digest
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
  { storage, locations }: RegistryAccess,
  path: string,
): Promise<Uint8Array | undefined> {
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

async function writeDeployment(options: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  environment: string;
  prepared: DeploymentWrite;
}): Promise<void> {
  const { storage, lease, environment, prepared } = options;
  await writeJson({
    storage,
    lease,
    path: envPath(environment),
    value: prepared.state,
  });
  for (const manifest of prepared.manifests) {
    await writeJson({
      storage,
      lease,
      path: hostPath(environment, manifest.hostId),
      value: manifest,
    });
  }
}

async function writeJson(options: {
  storage: AtlasPublicationStorage;
  lease: AtlasPublicationLease;
  path: string;
  value: unknown;
}): Promise<void> {
  const { storage, lease, path, value } = options;
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

function envPath(environment: string): string {
  return `environments/${environment}/deployment.json`;
}
function hostPath(environment: string, id: string): string {
  return `environments/${environment}/hosts/${id}/manifest.json`;
}
function revision(value: unknown): `sha256:${string}` {
  return sha256Digest(canonicalJson(value));
}
function requiredFlag(args: CliArguments, name: string): string {
  const value = args.flag(name);
  if (!value || value === 'true') throw new Error(`--${name} is required.`);
  return value;
}
function root(value: string, flag: string): string {
  if (value === 'true') throw new Error(`${flag} requires a URL.`);
  const url = new URL(value);
  if (!isSecureOrLoopbackUrl(url))
    throw new Error(`${flag} must use HTTPS except for loopback development.`);
  if (url.search || url.hash || url.username || url.password)
    throw new Error(`${flag} must be a registry root URL.`);

  return trimTrailingSlash(url.href);
}
