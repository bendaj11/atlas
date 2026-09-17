import type { AtlasStaticRegistry } from '@atlas/schema';
import type { CliArguments } from '../../shared/index.js';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import { pruneUnreferencedPreviewGenerations } from '../preview-pruning/preview-pruning.js';
import {
  verifyDeliveryWhileHeld,
  withPublicationLease,
} from '../publication-lease/publication-lease.js';
import type { AtlasPublicationStorage } from '../publication-storage/types.js';
import type { AtlasRegistryConfig } from '../registry-config/types.js';
import {
  assertExpectedRegistryRevision,
  readRegistryState,
  REGISTRY_PATH,
  writeRegistry,
} from '../registry-io/registry-io.js';
import { resolveRegistryArtifact } from '../static-registry/resolution/artifact-resolution.js';
import { removePreview } from '../static-registry/static-registry.js';
import type {
  AtlasPreviewPruneResult,
  AtlasPreviewRemovalResult,
} from '../types.js';

export async function removePreviewOnce({
  args,
  storage,
  artifactIdentifier,
  previewNumber,
  config,
  retryingAfterMutation,
}: {
  args: CliArguments;
  storage: AtlasPublicationStorage;
  artifactIdentifier: string;
  previewNumber: number;
  config: AtlasRegistryConfig | undefined;
  retryingAfterMutation: boolean;
}): Promise<AtlasPreviewRemovalResult> {
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

    assertExpectedRegistryRevision(args, current);
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

export async function prunePreviewsOnce({
  args,
  storage,
  previewStates,
  config,
  retryingAfterMutation,
  committedRemovals,
  onRegistryWritten,
}: {
  args: CliArguments;
  storage: AtlasPublicationStorage;
  previewStates: readonly AtlasArtifactPreviewState[];
  config: AtlasRegistryConfig | undefined;
  retryingAfterMutation: boolean;
  committedRemovals: number;
  onRegistryWritten: (removed: number) => void;
}): Promise<AtlasPreviewPruneResult> {
  return withPublicationLease(storage, async (lease) => {
    const state = await readRegistryState(storage);
    const current = requireRegistry(state.registry);
    assertExpectedRegistryRevision(args, current);

    const { registry, checked, removed } = removeClosedPreviews({
      current,
      previewStates,
    });

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

function removeClosedPreviews({
  current,
  previewStates,
}: {
  current: AtlasStaticRegistry;
  previewStates: readonly AtlasArtifactPreviewState[];
}): { registry: AtlasStaticRegistry; checked: number; removed: number } {
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

  return { registry, checked, removed };
}

function requireRegistry(
  registry: AtlasStaticRegistry | undefined,
): AtlasStaticRegistry {
  if (!registry) throw new Error('Atlas registry.json does not exist.');

  return registry;
}
