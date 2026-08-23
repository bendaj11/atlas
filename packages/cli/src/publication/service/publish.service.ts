import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import type { AtlasBuildResult } from '../../build/service/build.service.js';
import {
  createPublicationStorage,
  type AtlasPublicationLease,
  type AtlasPublicationObjectMetadata,
  type AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import { resolvePullRequestStatus } from '../pull-request/pull-request.js';
import type { AtlasRegistryConfig } from '../registry-config.js';
import {
  assertStaticRegistry,
  canonicalJson,
  descriptorFor,
  manifestBytes,
  publishArtifact,
  registryRevision,
  removePreview,
  resolveRegistryArtifact,
} from '../static-registry/static-registry.js';

export {
  defineAtlasRegistryConfig,
  loadAtlasRegistryConfig,
} from '../registry-config.js';
export type {
  AtlasPreviewHeadLookup,
  AtlasPreviewHeadResolver,
  AtlasPreviewHeadStatus,
  AtlasRegistryConfig,
} from '../registry-config.js';
export { S3PublicationStorage } from '../publication-storage/publication-storage.js';
export type {
  AtlasPublicationLease,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
  S3Options,
} from '../publication-storage/publication-storage.js';

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MUTABLE_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';

interface PublicationFile {
  path: string;
  bytes: Uint8Array;
  metadata: AtlasPublicationObjectMetadata;
}

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
  skippedReason?: string;
  cleanupWarnings: string[];
  manifest: AtlasManifestDescriptor;
  registryRevision: string;
}

export interface AtlasPreviewRemovalResult {
  removed: boolean;
  registryRevision: string;
}

export interface AtlasPreviewPruneResult {
  checked: number;
  removed: number;
  removedGenerations: number;
  registryRevision: string;
}

export interface AtlasProjectBuilder {
  publication(projectName: string): Promise<AtlasBuildResult>;
}

export class AtlasPublishService {
  constructor(
    private readonly args: CliArguments,
    private readonly builds?: AtlasProjectBuilder,
  ) {}

  async run(
    projectName: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPublishResult> {
    if (!this.builds)
      throw new Error('Atlas publish requires a workspace project.');
    const build = await this.builds.publication(projectName);
    await assertPreviewIsCurrent(build.manifest, config);
    const immutable = await publicationFiles(build);
    const descriptor = descriptorFor(
      immutable.manifest.path,
      immutable.manifest.bytes,
    );
    assertPublicRegistryConfigured(this.args, config);
    const storage = await createPublicationStorage(config?.storage, this.args);
    if (this.args.hasFlag('dry-run')) {
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      const mutation = publishArtifact(current, build.manifest, descriptor);
      return {
        uploaded: [
          ...immutable.payloads.map(({ path }) => path),
          descriptor.path,
          'registry.json',
        ],
        dryRun: true,
        cleanupWarnings: [],
        manifest: descriptor,
        registryRevision: mutation.registryRevision,
      };
    }
    if (build.manifest.preview) {
      await createAndVerify(storage, [
        ...immutable.payloads,
        immutable.manifest,
      ]);
      return withPublicationLease(storage, async (lease) => {
        await assertPreviewIsCurrent(build.manifest, config);
        return this.commitPublication(
          storage,
          lease,
          build.manifest,
          descriptor,
          immutable,
          config,
        );
      });
    }
    return withPublicationLease(storage, async (lease) => {
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      publishArtifact(current, build.manifest, descriptor);
      await createAndVerify(
        storage,
        [...immutable.payloads, immutable.manifest],
        lease,
      );
      return this.commitPublication(
        storage,
        lease,
        build.manifest,
        descriptor,
        immutable,
        config,
      );
    });
  }

  async removePreview(
    artifactIdentifier: string,
    previewNumber: number,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPreviewRemovalResult> {
    const storage = await createPublicationStorage(config?.storage, this.args);
    return withPublicationLease(storage, async (lease) => {
      const state = await readRegistryState(storage);
      const current = state.registry;
      if (!current) throw new Error('Atlas registry.json does not exist.');
      const { artifact } = resolveRegistryArtifact(current, artifactIdentifier);
      const mutation = removePreview(current, artifact.id, previewNumber);
      if (!mutation.changed) {
        return { removed: false, registryRevision: mutation.registryRevision };
      }
      assertExpectedRegistryRevision(this.args, current);
      await writeRegistry(
        storage,
        lease,
        mutation.registry,
        state.versionToken,
      );
      await config?.invalidate?.(['registry.json']);
      return { removed: true, registryRevision: mutation.registryRevision };
    });
  }

  async prunePreviews(
    previewStates: readonly AtlasArtifactPreviewState[],
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPreviewPruneResult> {
    const storage = await createPublicationStorage(config?.storage, this.args);
    return withPublicationLease(storage, async (lease) => {
      const state = await readRegistryState(storage);
      const current = state.registry;
      if (!current) throw new Error('Atlas registry.json does not exist.');
      assertExpectedRegistryRevision(this.args, current);
      let registry = current;
      let checked = 0;
      let removed = 0;
      for (const previewState of previewStates) {
        const artifact =
          previewState.kind === 'app'
            ? current.apps[previewState.id]
            : current.hosts[previewState.id];
        if (!artifact) continue;
        for (const number of Object.keys(artifact.previews).map(Number)) {
          checked += 1;
          if (previewState.openPreviews.has(number)) continue;
          const mutation = removePreview(registry, artifact.id, number);
          registry = mutation.registry;
          if (mutation.changed) removed += 1;
        }
      }
      if (removed) {
        await writeRegistry(storage, lease, registry, state.versionToken);
        await config?.invalidate?.(['registry.json']);
      }
      const removedGenerations = await pruneUnreferencedPreviewGenerations({
        storage,
        lease,
        registry,
        previewStates,
      });
      return {
        checked,
        removed,
        removedGenerations,
        registryRevision: registry.revision,
      };
    });
  }

  private async commitPublication(
    storage: AtlasPublicationStorage,
    lease: AtlasPublicationLease,
    manifest: AtlasPublishedArtifactManifest,
    descriptor: AtlasManifestDescriptor,
    immutable: Awaited<ReturnType<typeof publicationFiles>>,
    config: AtlasRegistryConfig | undefined,
  ): Promise<AtlasPublishResult> {
    await lease.assertHeld();
    const state = await readRegistryState(storage);
    const current = state.registry;
    assertExpectedRegistryRevision(this.args, current);
    const mutation = publishArtifact(current, manifest, descriptor);
    if (mutation.changed) {
      await writeRegistry(
        storage,
        lease,
        mutation.registry,
        state.versionToken,
      );
      await config?.invalidate?.(['registry.json']);
    }
    await verifyPublicRegistry(this.args, config, mutation.registry);
    return {
      uploaded: [
        ...immutable.payloads.map(({ path }) => path),
        immutable.manifest.path,
        ...(mutation.changed ? ['registry.json'] : []),
      ],
      dryRun: false,
      cleanupWarnings: [],
      manifest: descriptor,
      registryRevision: mutation.registryRevision,
    };
  }
}

interface PreviewGenerationPruneOptions {
  readonly storage: AtlasPublicationStorage;
  readonly lease: AtlasPublicationLease;
  readonly registry: AtlasStaticRegistry;
  readonly previewStates: readonly AtlasArtifactPreviewState[];
  readonly now?: number;
}

async function pruneUnreferencedPreviewGenerations({
  storage,
  lease,
  registry,
  previewStates,
  now = Date.now(),
}: PreviewGenerationPruneOptions): Promise<number> {
  const graceMilliseconds = 24 * 60 * 60 * 1000;
  const referenced = new Set(
    [...Object.values(registry.apps), ...Object.values(registry.hosts)]
      .flatMap((artifact) => Object.values(artifact.previews))
      .map(({ path }) => path.slice(0, -'/manifest.json'.length)),
  );
  const artifactScopes = previewStates.map(({ kind, id }) => {
    const collection = kind === 'app' ? 'apps' : 'hosts';
    return { prefix: `${collection}/${id}/previews/` };
  });
  let removed = 0;
  for (const { prefix } of artifactScopes) {
    const objects = await storage.list(prefix);
    const generations = new Map<string, typeof objects>();
    for (const object of objects) {
      const suffix = object.path.slice(prefix.length).split('/');
      if (suffix.length < 3) continue;
      const generation = `${prefix}${suffix[0]}/${suffix[1]}`;
      const entries = generations.get(generation) ?? [];
      entries.push(object);
      generations.set(generation, entries);
    }
    for (const [generation, entries] of generations) {
      if (referenced.has(generation)) continue;
      const modified = entries
        .map(({ lastModified }) =>
          lastModified ? Date.parse(lastModified) : Number.NaN,
        )
        .filter(Number.isFinite);
      if (!modified.length || Math.max(...modified) > now - graceMilliseconds)
        continue;
      for (const { path } of entries) {
        await lease.assertHeld();
        await storage.remove(path);
      }
      removed += 1;
    }
  }
  return removed;
}

async function publicationFiles(build: AtlasBuildResult): Promise<{
  payloads: PublicationFile[];
  manifest: PublicationFile;
}> {
  const bytes = manifestBytes(build.manifest);
  const prefix = artifactPrefix(build.manifest, bytes);
  const payloads = await Promise.all(
    build.manifest.files.map(async (file) => {
      const sourceBytes = new Uint8Array(
        await readFile(join(build.sourceDirectory, file.path)),
      );
      assertPayload(file.path, sourceBytes, file.digest, file.size);
      return {
        path: `${prefix}/${file.path}`,
        bytes: sourceBytes,
        metadata: {
          cacheControl: file.cacheControl,
          contentType: file.mediaType,
        },
      };
    }),
  );
  return {
    payloads,
    manifest: {
      path: `${prefix}/manifest.json`,
      bytes,
      metadata: {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        contentType: 'application/json',
      },
    },
  };
}

function artifactPrefix(
  manifest: AtlasPublishedArtifactManifest,
  bytes: Uint8Array,
): string {
  const collection = manifest.kind === 'app-artifact' ? 'apps' : 'hosts';
  if (manifest.release)
    return `${collection}/${manifest.id}/${manifest.release.version}`;
  const digest = createHash('sha256').update(bytes).digest('hex');
  return `${collection}/${manifest.id}/previews/${manifest.preview!.number}/${digest}`;
}

async function createAndVerify(
  storage: AtlasPublicationStorage,
  files: readonly PublicationFile[],
  lease?: AtlasPublicationLease,
): Promise<void> {
  for (const file of files) {
    await lease?.assertHeld();
    await createImmutable(storage, file);
  }
  for (const file of files) {
    await lease?.assertHeld();
    const bytes = await storage.read(file.path);
    const metadata = await storage.inspect(file.path);
    if (!bytes || !metadata) {
      throw new Error(`Published object ${file.path} is missing.`);
    }
    assertPayload(file.path, bytes, digest(file.bytes), file.bytes.byteLength);
    assertMetadata(file.path, metadata, file.metadata);
  }
}

async function createImmutable(
  storage: AtlasPublicationStorage,
  file: PublicationFile,
): Promise<void> {
  try {
    await storage.create(file.path, file.bytes, file.metadata);
  } catch (error) {
    const existing = await storage.read(file.path);
    const metadata = await storage.inspect(file.path);
    if (existing && metadata && digest(existing) === digest(file.bytes)) {
      assertMetadata(file.path, metadata, file.metadata);
      return;
    }
    throw error;
  }
}

async function writeRegistry(
  storage: AtlasPublicationStorage,
  lease: AtlasPublicationLease,
  registry: AtlasStaticRegistry,
  versionToken?: string,
): Promise<void> {
  await lease.assertHeld();
  const bytes = new TextEncoder().encode(`${canonicalJson(registry)}\n`);
  await storage.replace(
    'registry.json',
    bytes,
    {
      cacheControl: MUTABLE_CACHE_CONTROL,
      contentType: 'application/json',
    },
    versionToken ? { versionToken } : { createOnly: true },
  );
  const stored = await storage.read('registry.json');
  if (!stored || digest(stored) !== digest(bytes)) {
    throw new Error('Atlas could not verify registry.json after write.');
  }
}

export async function readRegistry(
  storage: AtlasPublicationStorage,
): Promise<AtlasStaticRegistry | undefined> {
  const bytes = await storage.read('registry.json');
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
): Promise<{
  registry: AtlasStaticRegistry | undefined;
  versionToken?: string;
}> {
  const before = await storage.inspect('registry.json');
  const registry = await readRegistry(storage);
  const after = await storage.inspect('registry.json');
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

async function assertPreviewIsCurrent(
  manifest: AtlasPublishedArtifactManifest,
  config: AtlasRegistryConfig | undefined,
): Promise<void> {
  if (!manifest.preview) return;
  const status = await resolvePullRequestStatus(
    {
      artifactId: manifest.id,
      prNumber: manifest.preview.number,
      gitSha: manifest.preview.gitSha,
      ...(manifest.preview.gitBranch
        ? { gitBranch: manifest.preview.gitBranch }
        : {}),
    },
    config,
  );
  if (status.state !== 'open') {
    throw new Error(`Preview #${manifest.preview.number} is ${status.state}.`);
  }
  if (status.headSha !== manifest.preview.gitSha) {
    throw new Error(
      `Stale preview job: built ${manifest.preview.gitSha}, current head is ${status.headSha}.`,
    );
  }
}

function assertExpectedRegistryRevision(
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

async function verifyPublicRegistry(
  args: CliArguments,
  config: AtlasRegistryConfig | undefined,
  expected: AtlasStaticRegistry,
): Promise<void> {
  if (config?.verifyRegistry) {
    await config.verifyRegistry(expected);
    return;
  }
  const root = publicRegistryRoot(args);
  const response = await fetch(new URL('registry.json', `${root}/`), {
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

function assertPublicRegistryConfigured(
  args: CliArguments,
  config: AtlasRegistryConfig | undefined,
): void {
  if (!config?.verifyRegistry) publicRegistryRoot(args);
}

function publicRegistryRoot(args: CliArguments): string {
  const value = args.flag('registry-url') ?? process.env.ATLAS_REGISTRY_URL;
  if (!value || value === 'true') {
    throw new Error('--registry-url or ATLAS_REGISTRY_URL is required.');
  }
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(
      'Atlas public registry URL must use HTTPS outside loopback.',
    );
  }
  if (url.pathname.endsWith('/registry.json')) {
    url.pathname = url.pathname.slice(0, -'registry.json'.length);
  }
  return url.href.replace(/\/$/u, '');
}

async function withPublicationLease<T>(
  storage: AtlasPublicationStorage,
  operation: (lease: AtlasPublicationLease) => Promise<T>,
): Promise<T> {
  const lease = await storage.acquireLock(publicationOwner());
  try {
    return await operation(lease);
  } finally {
    await lease.release();
  }
}

function assertPayload(
  path: string,
  bytes: Uint8Array,
  expectedDigest: string,
  expectedSize: number,
): void {
  if (bytes.byteLength !== expectedSize || digest(bytes) !== expectedDigest) {
    throw new Error(`Atlas payload ${path} changed after manifest generation.`);
  }
}

function assertMetadata(
  path: string,
  actual: AtlasPublicationObjectMetadata,
  expected: AtlasPublicationObjectMetadata,
): void {
  if (
    actual.cacheControl !== expected.cacheControl ||
    actual.contentType !== expected.contentType
  ) {
    throw new Error(`Atlas object ${path} has unexpected HTTP metadata.`);
  }
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function publicationOwner(): string {
  return `atlas:${process.pid}:${Date.now()}`;
}
