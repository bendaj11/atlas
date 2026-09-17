import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import { pruneUnreferencedPreviewGenerations } from '../preview-pruning/preview-pruning.js';
import {
  publicationFiles,
  publicationIdentity,
  uploadAndVerify,
  type PublicationFiles,
  type PublicationProgressReporter,
} from '../publication-files/publication-files.js';
import {
  verifyDeliveryWhileHeld,
  withPublicationLease,
} from '../publication-lease/publication-lease.js';
import {
  createPublicationStorage,
  type AtlasPublicationLease,
  type AtlasPublicationStorage,
} from '../publication-storage/publication-storage.js';
import { resolvePullRequestStatus } from '../pull-request/pull-request.js';
import {
  assertExpectedRegistryRevision,
  assertPublicRegistryConfigured,
  readRegistry,
  readRegistryState,
  REGISTRY_PATH,
  verifyPublicRegistry,
  writeRegistry,
} from '../registry-io/registry-io.js';
import type { AtlasRegistryConfig } from '../registry-config.js';
import {
  descriptorFor,
  publishArtifact,
  removePreview,
  resolveRegistryArtifact,
} from '../static-registry/static-registry.js';
import {
  CliArguments,
  cliError,
  withExponentialRetry,
} from '../../shared/index.js';
import type { AtlasBuildResult } from '../../build/index.js';

export interface AtlasPublishResult {
  uploaded: string[];
  dryRun: boolean;
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

export type AtlasPublishProgressReporter = PublicationProgressReporter;

interface PreparedPublication {
  readonly build: AtlasBuildResult;
  readonly immutable: PublicationFiles;
  readonly config: AtlasRegistryConfig | undefined;
}

interface CommitOptions {
  readonly storage: AtlasPublicationStorage;
  readonly lease: AtlasPublicationLease;
  readonly manifest: AtlasPublishedArtifactManifest;
  readonly descriptor: AtlasManifestDescriptor;
  readonly immutable: PublicationFiles;
  readonly config: AtlasRegistryConfig | undefined;
}

interface PreviewRemovalOptions {
  readonly storage: AtlasPublicationStorage;
  readonly artifactIdentifier: string;
  readonly previewNumber: number;
  readonly config: AtlasRegistryConfig | undefined;
  readonly retryingAfterMutation: boolean;
}

interface PreviewPruneOptions {
  readonly storage: AtlasPublicationStorage;
  readonly previewStates: readonly AtlasArtifactPreviewState[];
  readonly config: AtlasRegistryConfig | undefined;
  readonly retryingAfterMutation: boolean;
  readonly committedRemovals: number;
  readonly onRegistryWritten: (removed: number) => void;
}

export class AtlasPublishService {
  constructor(
    private readonly args: CliArguments,
    private readonly builds?: AtlasProjectBuilder,
    private readonly reportProgress: AtlasPublishProgressReporter = () =>
      undefined,
  ) {}

  async run(
    projectName: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPublishResult> {
    if (!this.builds)
      throw new Error('Atlas publish requires a workspace project.');
    this.reportProgress(`Building ${projectName}...`);
    const build = await this.builds.publication(projectName);
    await assertPreviewIsCurrent(build.manifest, config);
    const immutable = await publicationFiles(build);
    this.reportProgress(
      `Prepared ${publicationIdentity(build.manifest)}; ${immutable.payloads.length + 1} immutable file(s) ready.`,
    );
    assertPublicRegistryConfigured(this.args, config);

    return withExponentialRetry(
      () => this.publishPrepared({ build, immutable, config }),
      {
        onRetry: (attempt, delayMs) =>
          this.reportProgress(
            `Transient publication failure; retrying attempt ${attempt + 1} in ${delayMs}ms...`,
          ),
      },
    );
  }

  async removePreview(
    artifactIdentifier: string,
    previewNumber: number,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPreviewRemovalResult> {
    const storage = await createPublicationStorage(config?.storage, this.args);
    let retryingAfterMutation = false;

    return withExponentialRetry(
      () =>
        this.removePreviewOnce({
          storage,
          artifactIdentifier,
          previewNumber,
          config,
          retryingAfterMutation,
        }),
      {
        onRetry: () => {
          retryingAfterMutation = true;
        },
      },
    );
  }

  async prunePreviews(
    previewStates: readonly AtlasArtifactPreviewState[],
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPreviewPruneResult> {
    const storage = await createPublicationStorage(config?.storage, this.args);
    let retryingAfterMutation = false;
    let committedRemovals = 0;

    return withExponentialRetry(
      () =>
        this.prunePreviewsOnce({
          storage,
          previewStates,
          config,
          retryingAfterMutation,
          committedRemovals,
          onRegistryWritten: (removed) => {
            committedRemovals = removed;
          },
        }),
      {
        onRetry: () => {
          retryingAfterMutation = true;
        },
      },
    );
  }

  private async publishPrepared({
    build,
    immutable,
    config,
  }: PreparedPublication): Promise<AtlasPublishResult> {
    const descriptor = descriptorFor(
      immutable.manifest.path,
      immutable.manifest.bytes,
    );
    const storage = await createPublicationStorage(config?.storage, this.args);
    const files = [...immutable.payloads, immutable.manifest];
    if (this.args.hasFlag('dry-run')) {
      this.reportProgress('Reading registry.json for dry-run validation...');
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      const mutation = publishArtifact(current, build.manifest, descriptor);

      return {
        uploaded: [...files.map(({ path }) => path), REGISTRY_PATH],
        dryRun: true,
        manifest: descriptor,
        registryRevision: mutation.registryRevision,
      };
    }
    if (build.manifest.preview) {
      await uploadAndVerify({
        storage,
        files,
        reportProgress: this.reportProgress,
      });
      this.reportProgress('Waiting to acquire publication lock...');

      return withPublicationLease(storage, async (lease) => {
        await assertPreviewIsCurrent(build.manifest, config);

        return this.commitPublication({
          storage,
          lease,
          manifest: build.manifest,
          descriptor,
          immutable,
          config,
        });
      });
    }
    this.reportProgress('Waiting to acquire publication lock...');

    return withPublicationLease(storage, async (lease) => {
      this.reportProgress('Checking current registry revision...');
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      publishArtifact(current, build.manifest, descriptor);
      await uploadAndVerify({
        storage,
        files,
        lease,
        reportProgress: this.reportProgress,
      });

      return this.commitPublication({
        storage,
        lease,
        manifest: build.manifest,
        descriptor,
        immutable,
        config,
      });
    });
  }

  private async commitPublication({
    storage,
    lease,
    manifest,
    descriptor,
    immutable,
    config,
  }: CommitOptions): Promise<AtlasPublishResult> {
    await lease.assertHeld();
    this.reportProgress('Reading latest registry.json...');
    const state = await readRegistryState(storage);
    assertExpectedRegistryRevision(this.args, state.registry);
    const mutation = publishArtifact(state.registry, manifest, descriptor);
    const artifactPaths = [
      ...immutable.payloads.map(({ path }) => path),
      immutable.manifest.path,
    ];
    if (storage.verifyDelivery) {
      await config?.invalidate?.(artifactPaths);
      await verifyDeliveryWhileHeld({ storage, lease, paths: artifactPaths });
    }
    if (mutation.changed) {
      this.reportProgress('Updating registry.json and configured caches...');
      await writeRegistry({
        storage,
        lease,
        registry: mutation.registry,
        versionToken: state.versionToken,
      });
    }
    if (storage.verifyDelivery) {
      await config?.invalidate?.([REGISTRY_PATH]);
      await verifyDeliveryWhileHeld({ storage, lease, paths: [REGISTRY_PATH] });
    } else if (mutation.changed) {
      await config?.invalidate?.([REGISTRY_PATH]);
    }
    this.reportProgress('Verifying published registry...');
    await verifyPublicRegistry({
      args: this.args,
      config,
      expected: mutation.registry,
    });

    return {
      uploaded: [
        ...artifactPaths,
        ...(mutation.changed ? [REGISTRY_PATH] : []),
      ],
      dryRun: false,
      manifest: descriptor,
      registryRevision: mutation.registryRevision,
    };
  }

  private async removePreviewOnce({
    storage,
    artifactIdentifier,
    previewNumber,
    config,
    retryingAfterMutation,
  }: PreviewRemovalOptions): Promise<AtlasPreviewRemovalResult> {
    return withPublicationLease(storage, async (lease) => {
      const state = await readRegistryState(storage);
      const current = requireRegistry(state.registry);
      const { artifact } = resolveRegistryArtifact(current, artifactIdentifier);
      const mutation = removePreview(current, artifact.id, previewNumber);
      if (!mutation.changed) {
        if (retryingAfterMutation || storage.verifyDelivery) {
          await config?.invalidate?.([REGISTRY_PATH]);
          await verifyDeliveryWhileHeld({
            storage,
            lease,
            paths: [REGISTRY_PATH],
          });
        }

        return {
          removed: retryingAfterMutation,
          registryRevision: mutation.registryRevision,
        };
      }
      assertExpectedRegistryRevision(this.args, current);
      await writeRegistry({
        storage,
        lease,
        registry: mutation.registry,
        versionToken: state.versionToken,
      });
      await config?.invalidate?.([REGISTRY_PATH]);
      await verifyDeliveryWhileHeld({ storage, lease, paths: [REGISTRY_PATH] });

      return { removed: true, registryRevision: mutation.registryRevision };
    });
  }

  private async prunePreviewsOnce({
    storage,
    previewStates,
    config,
    retryingAfterMutation,
    committedRemovals,
    onRegistryWritten,
  }: PreviewPruneOptions): Promise<AtlasPreviewPruneResult> {
    return withPublicationLease(storage, async (lease) => {
      const state = await readRegistryState(storage);
      const current = requireRegistry(state.registry);
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
        await writeRegistry({
          storage,
          lease,
          registry,
          versionToken: state.versionToken,
        });
        onRegistryWritten(removed);
        await config?.invalidate?.([REGISTRY_PATH]);
      } else if (retryingAfterMutation || storage.verifyDelivery) {
        await config?.invalidate?.([REGISTRY_PATH]);
      }
      await verifyDeliveryWhileHeld({ storage, lease, paths: [REGISTRY_PATH] });
      const removedGenerations = await pruneUnreferencedPreviewGenerations({
        storage,
        lease,
        registry,
        previewStates,
      });

      return {
        checked,
        removed: removed || committedRemovals,
        removedGenerations,
        registryRevision: registry.revision,
      };
    });
  }
}

function requireRegistry(
  registry: AtlasStaticRegistry | undefined,
): AtlasStaticRegistry {
  if (!registry) throw new Error('Atlas registry.json does not exist.');

  return registry;
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
    throw cliError(
      `Preview #${manifest.preview.number} is ${status.state}.`,
      'Publish previews only from open pull requests; nothing to do for this job.',
      { code: 'ATLAS_PREVIEW_CLOSED' },
    );
  }
  if (status.headSha !== manifest.preview.gitSha) {
    throw cliError(
      `Stale preview job: built ${manifest.preview.gitSha}, current head is ${status.headSha}.`,
      'Let the CI job for the current head publish; this build is superseded.',
      { code: 'ATLAS_PREVIEW_STALE' },
    );
  }
}
