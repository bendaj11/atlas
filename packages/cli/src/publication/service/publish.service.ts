import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import type { AtlasBuildResult } from '../../build/index.js';
import {
  CliArguments,
  formatBytes,
  formatDuration,
  pluralize,
  silentProgress,
  withExponentialRetry,
  type AtlasProgressReporter,
} from '../../shared/index.js';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import { assertPreviewIsCurrent } from '../preview-currency/preview-currency.js';
import {
  prunePreviewsOnce,
  removePreviewOnce,
} from '../preview-removal/preview-removal.js';
import {
  preparePublicationFiles,
  derivePublicationIdentity,
  measurePublicationFiles,
  uploadAndVerify,
  type PublicationFiles,
} from '../publication-files/publication-files.js';
import {
  verifyDeliveryWhileHeld,
  withPublicationLease,
} from '../publication-lease/publication-lease.js';
import { createPublicationStorage } from '../publication-storage/publication-storage.js';
import { resolveParallelUploads } from '../storage-environment/storage-environment.js';
import type {
  AtlasPublicationLease,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';
import type { AtlasRegistryConfig } from '../registry-config/types.js';
import {
  assertExpectedRegistryRevision,
  assertPublicRegistryConfigured,
  readRegistry,
  readRegistryState,
  REGISTRY_PATH,
  verifyPublicRegistry,
  writeRegistry,
} from '../registry-io/registry-io.js';
import { createManifestDescriptor } from '../static-registry/descriptors/descriptors.js';
import { publishArtifact } from '../static-registry/static-registry.js';
import type {
  AtlasPreviewPruneResult,
  AtlasPreviewRemovalResult,
  AtlasProjectBuilder,
  AtlasPublishResult,
} from '../types.js';

interface PreparedPublication {
  readonly build: AtlasBuildResult;
  readonly immutable: PublicationFiles;
  readonly config: AtlasRegistryConfig | undefined;
  readonly concurrency: number;
}

interface CommitOptions {
  readonly storage: AtlasPublicationStorage;
  readonly lease: AtlasPublicationLease;
  readonly manifest: AtlasPublishedArtifactManifest;
  readonly descriptor: AtlasManifestDescriptor;
  readonly immutable: PublicationFiles;
  readonly config: AtlasRegistryConfig | undefined;
  readonly concurrency: number;
}

export class AtlasPublishService {
  constructor(
    private readonly args: CliArguments,
    private readonly builds?: AtlasProjectBuilder,
    private readonly progress: AtlasProgressReporter = silentProgress,
  ) {}

  async run(
    projectName: string,
    config?: AtlasRegistryConfig,
  ): Promise<AtlasPublishResult> {
    if (!this.builds)
      throw new Error('Atlas publish requires a workspace project.');

    const concurrency = resolveParallelUploads(this.args);

    this.progress.start(`Reading build output of ${projectName}`);
    const build = await this.builds.publication(projectName);
    await assertPreviewIsCurrent({ manifest: build.manifest, config });

    const immutable = await preparePublicationFiles(build);
    const { count, bytes } = measurePublicationFiles(immutable);

    this.progress.succeed(
      `Prepared ${derivePublicationIdentity(build.manifest)}: ${pluralize(count, 'file')}, ${formatBytes(bytes)}`,
    );
    assertPublicRegistryConfigured(this.args, config);

    return withExponentialRetry(
      () => this.publishPrepared({ build, immutable, config, concurrency }),
      {
        onRetry: (attempt, delayMs) =>
          this.progress.warn(
            `Storage request failed temporarily. Retrying in ${formatDuration(delayMs)} (attempt ${attempt + 1}).`,
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
        removePreviewOnce({
          args: this.args,
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
        prunePreviewsOnce({
          args: this.args,
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
    concurrency,
  }: PreparedPublication): Promise<AtlasPublishResult> {
    const descriptor = createManifestDescriptor(
      immutable.manifest.path,
      immutable.manifest.bytes,
    );
    const storage = await createPublicationStorage(config?.storage, this.args);
    const files = [...immutable.payloads, immutable.manifest];
    const version = describeVersion(build.manifest);

    if (this.args.hasFlag('dry-run')) {
      this.progress.start('Checking registry');

      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      const mutation = publishArtifact(current, build.manifest, descriptor);
      this.progress.succeed(`Registry accepts ${version}`);

      return {
        uploaded: [...files.map(({ path }) => path), REGISTRY_PATH],
        dryRun: true,
        manifest: descriptor,
        registryRevision: mutation.registryRevision,
      };
    }

    const commit = (lease: AtlasPublicationLease) =>
      this.commitPublication({
        storage,
        lease,
        manifest: build.manifest,
        descriptor,
        immutable,
        config,
        concurrency,
      });

    if (build.manifest.preview) {
      await uploadAndVerify({
        storage,
        files: immutable,
        concurrency,
        progress: this.progress,
      });
      this.progress.start('Waiting for publish lock');

      return withPublicationLease(storage, async (lease) => {
        this.progress.succeed('Acquired publish lock');
        await assertPreviewIsCurrent({ manifest: build.manifest, config });

        return commit(lease);
      });
    }

    this.progress.start('Waiting for publish lock');

    return withPublicationLease(storage, async (lease) => {
      this.progress.succeed('Acquired publish lock');
      this.progress.start('Checking registry');
      const current = await readRegistry(storage);
      assertExpectedRegistryRevision(this.args, current);
      publishArtifact(current, build.manifest, descriptor);
      this.progress.succeed(`Registry accepts ${version}`);
      await uploadAndVerify({
        storage,
        files: immutable,
        concurrency,
        lease,
        progress: this.progress,
      });

      return commit(lease);
    });
  }

  private async commitPublication({
    storage,
    lease,
    manifest,
    descriptor,
    immutable,
    config,
    concurrency,
  }: CommitOptions): Promise<AtlasPublishResult> {
    const version = describeVersion(manifest);

    await lease.assertHeld();

    const state = await readRegistryState(storage);
    assertExpectedRegistryRevision(this.args, state.registry);
    const mutation = publishArtifact(state.registry, manifest, descriptor);
    const artifactPaths = [
      ...immutable.payloads.map(({ path }) => path),
      immutable.manifest.path,
    ];

    if (storage.verifyDelivery) {
      this.progress.start(
        `Checking public delivery of ${pluralize(artifactPaths.length, 'file')}`,
      );
      await config?.invalidate?.(artifactPaths);
      await verifyDeliveryWhileHeld({
        storage,
        lease,
        paths: artifactPaths,
        concurrency,
      });
      this.progress.succeed(
        `Public URLs serve all ${pluralize(artifactPaths.length, 'file')}`,
      );
    }

    this.progress.start('Updating registry');

    if (mutation.changed) {
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

    this.progress.succeed(
      mutation.changed
        ? `Registry now lists ${version}`
        : `Registry already lists ${version}`,
    );
    this.progress.start('Checking public registry');
    await verifyPublicRegistry({
      args: this.args,
      config,
      expected: mutation.registry,
    });
    this.progress.succeed('Public registry serves the new revision');

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
}

function describeVersion(manifest: AtlasPublishedArtifactManifest): string {
  return manifest.release
    ? `version ${manifest.release.version}`
    : `preview #${manifest.preview!.number}`;
}
