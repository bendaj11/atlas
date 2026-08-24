import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import type {
  AtlasAppArtifactManifest,
  AtlasDeploymentManifestReference,
  AtlasHostDeploymentManifest,
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
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
  canonicalJson,
  assertEnvironmentName,
  assertStaticRegistry,
  emptyStaticRegistry,
  importRelease,
  resolveRegistryArtifact,
  resolveRelease,
  selectDeployment,
  type AtlasResolvedRelease,
} from '../publication/static-registry/static-registry.js';
import {
  readRegistry,
  readRegistryState,
} from '../publication/service/publish.service.js';
import { createHostDiscovery, hostDiscoveryPath } from './host-discovery.js';
import {
  bindSelectedHost,
  readHostBindingRequest,
} from './host-binding/host-binding.js';

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
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

export class AtlasDeploymentConvergenceError extends Error {
  constructor(readonly result: AtlasDeployResult) {
    super(
      `Atlas deployment desired state was committed, but these hosts remain pending: ${result.pendingHosts.join(', ')}. Repeat same deploy command to resume convergence.`,
    );
    this.name = 'AtlasDeploymentConvergenceError';
  }
}

interface SourceSnapshot {
  rootUrl: string;
  registry: AtlasStaticRegistry;
}

export class AtlasDeployService {
  constructor(private readonly args: CliArguments) {}

  async run(
    artifactIdentifier: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasDeployResult> {
    const environment = requiredFlag(this.args, 'to');
    assertEnvironmentName(environment);
    const selector = requiredFlag(this.args, 'version');
    const targetRoot = registryRoot(
      this.args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL,
      '--registry-url or ATLAS_REGISTRY_URL',
    );
    const sourceRoot = registryRoot(
      this.args.flag('source-registry-url') ??
        process.env.ATLAS_SOURCE_REGISTRY_URL ??
        targetRoot,
      '--source-registry-url or ATLAS_SOURCE_REGISTRY_URL',
    );
    const storage = await createPublicationStorage(config?.storage, this.args);
    const targetRegistry =
      (await readRegistry(storage)) ?? emptyStaticRegistry();
    const source = await sourceSnapshot(
      sourceRoot,
      sourceRoot === targetRoot ? targetRegistry : undefined,
    );
    const sourceIdentifier = resolveSourceIdentifier(
      targetRegistry,
      source.registry,
      artifactIdentifier,
      sourceRoot === targetRoot,
    );
    const selected = resolveRelease(
      source.registry,
      sourceIdentifier,
      selector,
    );
    const hostBinding = readHostBindingRequest(this.args, selected.kind);
    if (this.args.hasFlag('dry-run')) {
      assertExpectedRevision(this.args, targetRegistry);
      const simulated = await validateDryRun({
        source,
        targetRoot,
        storage,
        targetRegistry,
        selected,
        environment,
        hostBinding,
      });
      return {
        artifactId: selected.artifact.id,
        environment,
        version: selected.version,
        registryRevision: simulated.revision,
        convergedHosts: [],
        pendingHosts: [],
        dryRun: true,
      };
    }

    const transferredManifest = await transferRelease(
      source,
      targetRoot,
      storage,
      selected,
    );
    const targetSelection: AtlasResolvedRelease = {
      ...selected,
      manifest: transferredManifest,
    };
    return withLease(storage, async (lease) => {
      await lease.assertHeld();
      const state = await readRegistryState(storage);
      const current = state.registry ?? emptyStaticRegistry();
      assertExpectedRevision(this.args, current);
      const imported = importRelease(current, targetSelection);
      const affectedHosts = await affectedHostIds(
        storage,
        imported,
        environment,
        targetSelection,
      );
      const projections = await createHostProjections(
        storage,
        imported,
        environment,
        affectedHosts,
        targetRoot,
        targetSelection,
      );
      const expected = Object.fromEntries(
        projections.map((projection) => [
          projection.hostId,
          projection.deploymentRevision,
        ]),
      );
      const selectionMutation = selectDeployment(
        imported,
        environment,
        targetSelection,
        expected,
      );
      const mutation = bindSelectedHost({
        mutation: selectionMutation,
        environment,
        selected: targetSelection,
        ...hostBinding,
      });
      await writeMutableJson(
        storage,
        lease,
        'registry.json',
        mutation.registry,
        state.versionToken,
      );
      await config?.invalidate?.(['registry.json']);

      const convergedHosts: string[] = [];
      const pendingHosts: string[] = [];
      for (const projection of projections) {
        try {
          const path = `environments/${environment}/hosts/${projection.hostId}/manifest.json`;
          await writeHostProjection(storage, lease, path, projection);
          await config?.invalidate?.([path]);
          convergedHosts.push(projection.hostId);
        } catch {
          pendingHosts.push(projection.hostId);
        }
      }
      if (targetSelection.kind === 'host' && pendingHosts.length === 0) {
        const hostId = targetSelection.artifact.id;
        try {
          const path = hostDiscoveryPath(hostId);
          const discovery = createHostDiscovery(
            mutation.registry,
            hostId,
            targetRoot,
          );
          await writeMutableJson(storage, lease, path, discovery);
          await config?.invalidate?.([path]);
        } catch {
          pendingHosts.push(hostId);
        }
      }
      const result: AtlasDeployResult = {
        artifactId: selected.artifact.id,
        environment,
        version: selected.version,
        registryRevision: mutation.registryRevision,
        convergedHosts: convergedHosts.filter(
          (hostId) => !pendingHosts.includes(hostId),
        ),
        pendingHosts,
        dryRun: false,
      };
      if (pendingHosts.length) {
        throw new AtlasDeploymentConvergenceError(result);
      }
      return result;
    });
  }
}

async function writeHostProjection(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  path: string,
  projection: AtlasHostDeploymentManifest,
): Promise<void> {
  const delays = [0, 50, 100];
  let failure: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      await writeMutableJson(storage, lease, path, projection);
      return;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

async function validateDryRun(options: {
  source: SourceSnapshot;
  targetRoot: string;
  storage: AtlasPublicationStorage;
  targetRegistry: AtlasStaticRegistry;
  selected: AtlasResolvedRelease;
  environment: string;
  hostBinding: ReturnType<typeof readHostBindingRequest>;
}): Promise<AtlasStaticRegistry> {
  const {
    source,
    targetRoot,
    storage,
    targetRegistry,
    selected,
    environment,
    hostBinding,
  } = options;
  let descriptor = selected.manifest;
  if (source.rootUrl === targetRoot) {
    await verifyStoredRelease(storage, selected);
  } else {
    const bytes = await fetchDescriptor(source.rootUrl, selected.manifest);
    const manifest = parseArtifactManifest(bytes);
    assertSelectedManifestIdentity(manifest, selected);
    descriptor = descriptorForBytes(selected.manifest.path, bytes);
  }
  const imported = importRelease(targetRegistry, {
    ...selected,
    manifest: descriptor,
  });
  const mutation = selectDeployment(
    imported,
    environment,
    { ...selected, manifest: descriptor },
    {},
  );
  const bound = bindSelectedHost({
    mutation,
    environment,
    selected,
    ...hostBinding,
  });
  if (selected.kind === 'host') {
    createHostDiscovery(bound.registry, selected.artifact.id, targetRoot);
  }
  return bound.registry;
}

function descriptorForBytes(
  path: string,
  bytes: Uint8Array,
): AtlasManifestDescriptor {
  return {
    path,
    digest: digest(bytes),
    size: bytes.byteLength,
    mediaType: 'application/json',
  };
}

function resolveSourceIdentifier(
  target: AtlasStaticRegistry,
  source: AtlasStaticRegistry,
  identifier: string,
  sameRegistry: boolean,
): string {
  try {
    return resolveRegistryArtifact(target, identifier).artifact.id;
  } catch (error) {
    if (sameRegistry) throw error;
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        identifier,
      )
    ) {
      return resolveRegistryArtifact(source, identifier).artifact.id;
    }
    throw new Error(
      `Atlas artifact "${identifier}" is not registered in the target registry. Use its stable UUID for the first cross-registry deployment.`,
      { cause: error },
    );
  }
}

async function sourceSnapshot(
  rootUrl: string,
  local: AtlasStaticRegistry | undefined,
): Promise<SourceSnapshot> {
  if (local) return { rootUrl, registry: local };
  const bytes = await fetchVerified(
    new URL('registry.json', `${rootUrl}/`).href,
    'application/json',
  );
  const registry = JSON.parse(
    new TextDecoder().decode(bytes),
  ) as AtlasStaticRegistry;
  assertStaticRegistry(registry);
  return { rootUrl, registry };
}

async function transferRelease(
  source: SourceSnapshot,
  targetRoot: string,
  storage: AtlasPublicationStorage,
  selected: AtlasResolvedRelease,
): Promise<AtlasManifestDescriptor> {
  if (source.rootUrl === targetRoot) {
    await verifyStoredRelease(storage, selected);
    return selected.manifest;
  }
  const manifestBytes = await fetchDescriptor(
    source.rootUrl,
    selected.manifest,
  );
  const manifest = parseArtifactManifest(manifestBytes);
  assertSelectedManifestIdentity(manifest, selected);
  const manifestDirectory = posix.dirname(selected.manifest.path);
  for (const file of manifest.files) {
    const sourcePath = `${manifestDirectory}/${file.path}`;
    await transferPayload(
      storage,
      sourcePath,
      new URL(sourcePath, `${source.rootUrl}/`).href,
      file,
    );
  }
  await createOrReuse(storage, selected.manifest.path, manifestBytes, {
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    contentType: selected.manifest.mediaType,
  });
  return selected.manifest;
}

async function verifyStoredRelease(
  storage: AtlasPublicationStorage,
  selected: AtlasResolvedRelease,
): Promise<void> {
  const manifestBytes = await storage.read(selected.manifest.path);
  const manifestMetadata = await storage.inspect(selected.manifest.path);
  if (!manifestBytes || !manifestMetadata) {
    throw new Error(`Target manifest ${selected.manifest.path} is missing.`);
  }
  assertBytes(
    selected.manifest.path,
    manifestBytes,
    selected.manifest.digest,
    selected.manifest.size,
  );
  assertStoredMetadata(selected.manifest.path, manifestMetadata, {
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    contentType: selected.manifest.mediaType,
  });
  const manifest = parseArtifactManifest(manifestBytes);
  assertSelectedManifestIdentity(manifest, selected);
  const directory = posix.dirname(selected.manifest.path);
  for (const file of manifest.files) {
    const path = `${directory}/${file.path}`;
    const bytes = await storage.read(path);
    const metadata = await storage.inspect(path);
    if (!bytes || !metadata)
      throw new Error(`Target payload ${path} is missing.`);
    assertBytes(path, bytes, file.digest, file.size);
    assertStoredMetadata(path, metadata, {
      cacheControl: file.cacheControl,
      contentType: file.mediaType,
    });
  }
}

async function transferPayload(
  storage: AtlasPublicationStorage,
  path: string,
  url: string,
  descriptor: {
    digest: string;
    size: number;
    mediaType: string;
    cacheControl: string;
  },
): Promise<void> {
  const existing = await storage.read(path);
  if (existing) {
    assertBytes(path, existing, descriptor.digest, descriptor.size);
    const metadata = await storage.inspect(path);
    if (!metadata)
      throw new Error(`Target payload metadata for ${path} is missing.`);
    assertStoredMetadata(path, metadata, {
      cacheControl: descriptor.cacheControl,
      contentType: descriptor.mediaType,
    });
    return;
  }
  const response = await fetchResponse(url);
  assertResponseMetadata(url, response, descriptor);
  if (!response.body) throw new Error(`Atlas source returned no body: ${url}`);
  const [uploadStream, verificationStream] = response.body.tee();
  let created = false;
  try {
    const [, verification] = await Promise.all([
      storage
        .create(path, asAsyncIterable(uploadStream), {
          cacheControl: descriptor.cacheControl,
          contentType: descriptor.mediaType,
        })
        .then(() => {
          created = true;
        }),
      hashStream(asAsyncIterable(verificationStream)),
    ]);
    if (
      verification.size !== descriptor.size ||
      verification.digest !== descriptor.digest
    ) {
      if (created) await storage.remove(path);
      throw new Error(
        `Atlas rejected ${path}: streamed bytes differ from descriptor.`,
      );
    }
  } catch (error) {
    const stored = await storage.read(path);
    if (stored) {
      assertBytes(path, stored, descriptor.digest, descriptor.size);
      const metadata = await storage.inspect(path);
      if (!metadata)
        throw new Error(`Target payload metadata for ${path} is missing.`);
      assertStoredMetadata(path, metadata, {
        cacheControl: descriptor.cacheControl,
        contentType: descriptor.mediaType,
      });
      return;
    }
    throw error;
  }
}

async function affectedHostIds(
  storage: AtlasPublicationStorage,
  registry: AtlasStaticRegistry,
  environment: string,
  selected: AtlasResolvedRelease,
): Promise<string[]> {
  if (selected.kind === 'host') return [selected.artifact.id];
  const deployment = registry.deployments[environment];
  if (!deployment) return [];
  const next = (await readStoredManifest(
    storage,
    selected.manifest,
  )) as AtlasAppArtifactManifest;
  const previousEntries = await readSelectedApps(storage, registry, deployment);
  const nextEntries = [
    ...previousEntries.filter(({ id }) => id !== selected.artifact.id),
    { id: selected.artifact.id, manifest: next },
  ];
  const ids = new Set<string>();
  for (const hostId of Object.keys(deployment.hosts)) {
    if (
      compositionContains(previousEntries, hostId, selected.artifact.id) ||
      compositionContains(nextEntries, hostId, selected.artifact.id)
    ) {
      ids.add(hostId);
    }
  }
  return [...ids].sort();
}

async function readSelectedApps(
  storage: AtlasPublicationStorage,
  registry: AtlasStaticRegistry,
  deployment: AtlasStaticRegistry['deployments'][string],
): Promise<Array<{ id: string; manifest: AtlasAppArtifactManifest }>> {
  return Promise.all(
    Object.entries(deployment.apps).map(async ([id, selection]) => ({
      id,
      manifest: (await readStoredManifest(
        storage,
        releaseDescriptor(registry, 'app', id, selection.version),
      )) as AtlasAppArtifactManifest,
    })),
  );
}

function compositionContains(
  entries: readonly { id: string; manifest: AtlasAppArtifactManifest }[],
  hostId: string,
  appId: string,
): boolean {
  const mounted = entries.filter(({ manifest }) => isMounted(manifest, hostId));
  return (
    mounted.some(({ id }) => id === appId) ||
    collectWidgetProviderIds(mounted, entries).has(appId)
  );
}

async function createHostProjections(
  storage: AtlasPublicationStorage,
  registry: AtlasStaticRegistry,
  environment: string,
  hostIds: readonly string[],
  targetRoot: string,
  selected: AtlasResolvedRelease,
): Promise<AtlasHostDeploymentManifest[]> {
  const deployment = structuredClone(
    registry.deployments[environment] ?? {
      hosts: {},
      apps: {},
      expectedHostRevisions: {},
    },
  );
  const collection =
    selected.kind === 'app' ? deployment.apps : deployment.hosts;
  collection[selected.artifact.id] = {
    ...collection[selected.artifact.id],
    version: selected.version,
  };
  const appEntries = await Promise.all(
    Object.entries(deployment.apps).map(async ([id, selection]) => {
      const descriptor = releaseDescriptor(
        registry,
        'app',
        id,
        selection.version,
      );
      return {
        id,
        descriptor,
        manifest: (await readStoredManifest(
          storage,
          descriptor,
        )) as AtlasAppArtifactManifest,
      };
    }),
  );
  const projections: AtlasHostDeploymentManifest[] = [];
  for (const hostId of hostIds) {
    const hostSelection = deployment.hosts[hostId];
    if (!hostSelection) continue;
    const host = reference(
      targetRoot,
      releaseDescriptor(registry, 'host', hostId, hostSelection.version),
    );
    const apps = appEntries
      .filter(({ manifest }) => isMounted(manifest, hostId))
      .sort((left, right) => left.id.localeCompare(right.id));
    const mountedIds = new Set(apps.map(({ id }) => id));
    const providerIds = collectWidgetProviderIds(apps, appEntries);
    const appReferences = apps
      .map(({ descriptor }) => reference(targetRoot, descriptor))
      .sort((left, right) => left.path.localeCompare(right.path));
    const widgetProviders = appEntries
      .filter(({ id }) => providerIds.has(id) && !mountedIds.has(id))
      .map(({ descriptor }) => reference(targetRoot, descriptor))
      .sort((left, right) => left.path.localeCompare(right.path));
    const content = {
      hostId,
      environment,
      host,
      apps: appReferences,
      ...(widgetProviders.length ? { widgetProviders } : {}),
    };
    projections.push({
      schemaVersion: '2',
      kind: 'host-deployment',
      ...content,
      deploymentRevision: `sha256:${createHash('sha256')
        .update(canonicalJson(content))
        .digest('hex')}`,
    });
  }
  return projections;
}

function releaseDescriptor(
  registry: AtlasStaticRegistry,
  kind: 'app' | 'host',
  artifactId: string,
  version: string,
): AtlasManifestDescriptor {
  const artifact =
    kind === 'app' ? registry.apps[artifactId] : registry.hosts[artifactId];
  const descriptor = artifact?.releases[version];
  if (!descriptor) {
    throw new Error(
      `Atlas ${kind} "${artifactId}" has no registered release "${version}".`,
    );
  }
  return descriptor;
}

function assertSelectedManifestIdentity(
  manifest: AtlasPublishedArtifactManifest,
  selected: AtlasResolvedRelease,
): void {
  const kind = manifest.kind === 'app-artifact' ? 'app' : 'host';
  if (
    manifest.id !== selected.artifact.id ||
    manifest.name !== selected.artifact.name ||
    kind !== selected.kind ||
    manifest.release?.version !== selected.version
  ) {
    throw new Error(
      'Source release manifest identity does not match registry selection.',
    );
  }
}

function collectWidgetProviderIds(
  mounted: readonly { id: string; manifest: AtlasAppArtifactManifest }[],
  available: readonly { id: string; manifest: AtlasAppArtifactManifest }[],
): Set<string> {
  const byId = new Map(available.map((entry) => [entry.id, entry.manifest]));
  const providers = new Set<string>();
  const pending = mounted.flatMap(
    ({ manifest }) => manifest.externalAppsDependencies ?? [],
  );
  while (pending.length) {
    const id = pending.shift()!;
    if (providers.has(id)) continue;
    const manifest = byId.get(id);
    if (!manifest) continue;
    providers.add(id);
    pending.push(...(manifest.externalAppsDependencies ?? []));
  }
  return providers;
}

function isMounted(
  manifest: AtlasAppArtifactManifest,
  hostId: string,
): boolean {
  return manifest.placements.some((placement) =>
    placementTargetsHost(placement, hostId),
  );
}

function reference(
  rootUrl: string,
  descriptor: AtlasManifestDescriptor,
): AtlasDeploymentManifestReference {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${rootUrl}/`).href,
  };
}

async function readStoredManifest(
  storage: AtlasPublicationStorage,
  descriptor: AtlasManifestDescriptor,
): Promise<AtlasPublishedArtifactManifest> {
  const bytes = await storage.read(descriptor.path);
  if (!bytes) throw new Error(`Target manifest ${descriptor.path} is missing.`);
  assertBytes(descriptor.path, bytes, descriptor.digest, descriptor.size);
  return parseArtifactManifest(bytes);
}

function parseArtifactManifest(
  bytes: Uint8Array,
): AtlasPublishedArtifactManifest {
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  assertPublishedArtifactManifest(value);
  return value;
}

async function fetchDescriptor(
  rootUrl: string,
  descriptor: AtlasManifestDescriptor,
): Promise<Uint8Array> {
  const url = new URL(descriptor.path, `${rootUrl}/`).href;
  const response = await fetchResponse(url);
  assertResponseMetadata(url, response, descriptor);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertBytes(descriptor.path, bytes, descriptor.digest, descriptor.size);
  return bytes;
}

async function fetchVerified(
  url: string,
  expectedMediaType?: string,
): Promise<Uint8Array> {
  const response = await fetchResponse(url);
  if (expectedMediaType) {
    const mediaType = response.headers.get('content-type');
    if (!mediaTypeMatches(mediaType, expectedMediaType)) {
      throw new Error(
        `Atlas source ${url} returned Content-Type ${mediaType ?? 'missing'}; expected ${expectedMediaType}.`,
      );
    }
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchResponse(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' &&
    !(
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    )
  ) {
    throw new Error(`Atlas source URL must use HTTPS outside loopback: ${url}`);
  }
  const response = await fetch(url, {
    headers: { 'Accept-Encoding': 'identity' },
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `Atlas refuses redirects while copying immutable bytes: ${url}`,
    );
  }
  if (!response.ok)
    throw new Error(`Atlas source returned HTTP ${response.status}: ${url}`);
  const encoding = response.headers.get('content-encoding');
  if (encoding && encoding !== 'identity') {
    throw new Error(`Atlas source must return identity encoding: ${url}`);
  }
  return response;
}

function assertResponseMetadata(
  url: string,
  response: Response,
  descriptor: { size: number; mediaType: string },
): void {
  const mediaType = response.headers.get('content-type');
  if (!mediaTypeMatches(mediaType, descriptor.mediaType)) {
    throw new Error(
      `Atlas source ${url} returned Content-Type ${mediaType ?? 'missing'}; expected ${descriptor.mediaType}.`,
    );
  }
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) !== descriptor.size) {
    throw new Error(
      `Atlas source ${url} returned an unexpected Content-Length.`,
    );
  }
}

function mediaTypeMatches(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  return mediaTypeEssence(actual) === mediaTypeEssence(expected);
}

function mediaTypeEssence(value: string): string {
  return value.split(';', 1)[0]!.trim().toLowerCase();
}

async function hashStream(
  stream: AsyncIterable<Uint8Array>,
): Promise<{ digest: `sha256:${string}`; size: number }> {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of stream) {
    hash.update(chunk);
    size += chunk.byteLength;
  }
  return { digest: `sha256:${hash.digest('hex')}`, size };
}

async function* asAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) return;
      yield result.value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function createOrReuse(
  storage: AtlasPublicationStorage,
  path: string,
  bytes: Uint8Array,
  metadata: { cacheControl: string; contentType: string },
): Promise<void> {
  try {
    await storage.create(path, bytes, metadata);
  } catch (error) {
    const existing = await storage.read(path);
    if (!existing || digest(existing) !== digest(bytes)) throw error;
    const existingMetadata = await storage.inspect(path);
    if (!existingMetadata) throw error;
    assertStoredMetadata(path, existingMetadata, metadata);
  }
}

function assertStoredMetadata(
  path: string,
  actual: { cacheControl: string; contentType: string },
  expected: { cacheControl: string; contentType: string },
): void {
  if (
    actual.cacheControl !== expected.cacheControl ||
    actual.contentType !== expected.contentType
  ) {
    throw new Error(`Atlas object ${path} has unexpected HTTP metadata.`);
  }
}

async function writeMutableJson(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  path: string,
  value: unknown,
  versionToken?: string,
): Promise<void> {
  await lease.assertHeld();
  const bytes = new TextEncoder().encode(`${canonicalJson(value)}\n`);
  const previous = versionToken ? undefined : await storage.inspect(path);
  await storage.replace(
    path,
    bytes,
    {
      cacheControl: MUTABLE_CACHE_CONTROL,
      contentType: 'application/json',
    },
    versionToken
      ? { versionToken }
      : previous?.versionToken
        ? { versionToken: previous.versionToken }
        : { createOnly: true },
  );
  const stored = await storage.read(path);
  if (!stored || digest(stored) !== digest(bytes)) {
    throw new Error(`Atlas could not verify ${path} after write.`);
  }
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

function assertExpectedRevision(
  args: CliArguments,
  registry: AtlasStaticRegistry,
): void {
  const expected = args.flag('expected-registry-revision');
  if (expected && expected !== registry.revision) {
    throw new Error(
      `Registry revision conflict: expected ${expected}, found ${registry.revision}.`,
    );
  }
}

function assertBytes(
  path: string,
  bytes: Uint8Array,
  expectedDigest: string,
  expectedSize: number,
): void {
  if (bytes.byteLength !== expectedSize || digest(bytes) !== expectedDigest) {
    throw new Error(`Atlas rejected ${path}: byte size or SHA-256 differs.`);
  }
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function requiredFlag(args: CliArguments, name: string): string {
  const value = args.flag(name);
  if (!value || value === 'true') throw new Error(`--${name} is required.`);
  return value;
}

function registryRoot(value: string | undefined, subject: string): string {
  if (!value) throw new Error(`${subject} is required.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error(`${subject} must use HTTPS outside loopback development.`);
  }
  if (url.pathname.endsWith('/registry.json')) {
    url.pathname = posix.dirname(url.pathname);
  }
  return url.href.replace(/\/$/, '');
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}
