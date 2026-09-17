import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import type { AtlasBuildResult } from '../../build/index.js';
import { CliArguments, withExponentialRetry } from '../../shared/index.js';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import { assertPreviewIsCurrent } from '../preview-currency/preview-currency.js';
import {
  prunePreviewsOnce,
  removePreviewOnce,
} from '../preview-removal/preview-removal.js';
import {
  publicationFiles,
  publicationIdentity,
  uploadAndVerify,
  type PublicationFiles,
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
import type { AtlasRegistryConfig } from '../registry-config.js';
import {
  assertExpectedRegistryRevision,
  assertPublicRegistryConfigured,
  readRegistry,
  readRegistryState,
  REGISTRY_PATH,
  verifyPublicRegistry,
  writeRegistry,
} from '../registry-io/registry-io.js';
import {
  descriptorFor,
  publishArtifact,
} from '../static-registry/static-registry.js';
import type {
  AtlasPreviewPruneResult,
  AtlasPreviewRemovalResult,
  AtlasProjectBuilder,
  AtlasPublishProgressReporter,
  AtlasPublishResult,
} from '../types.js';

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
    await assertPreviewIsCurrent({ manifest: build.manifest, config });

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

    const commit = (lease: AtlasPublicationLease) =>
      this.commitPublication({
        storage,
        lease,
        manifest: build.manifest,
        descriptor,
        immutable,
        config,
      });

    if (build.manifest.preview) {
      await uploadAndVerify({
        storage,
        files,
        reportProgress: this.reportProgress,
      });
      this.reportProgress('Waiting to acquire publication lock...');

      return withPublicationLease(storage, async (lease) => {
        await assertPreviewIsCurrent({ manifest: build.manifest, config });

        return commit(lease);
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
}
