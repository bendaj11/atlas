import { jest } from '@jest/globals';
import type { AtlasStaticRegistry } from '@atlas/schema';
import type { AtlasArtifactPreviewState } from '../pr-state-file/pr-state-file.js';
import type { AtlasPublicationLease } from '../publication-storage/types.js';
import { InMemoryPublicationStorage } from '../publication-storage/publication-storage.testkit.js';
import { createEmptyStaticRegistry } from '../static-registry/static-registry.js';
import { pruneUnreferencedPreviewGenerations } from './preview-pruning.js';

export class PreviewPruningDriver {
  private readonly storage = new InMemoryPublicationStorage();
  private readonly lease: AtlasPublicationLease = {
    assertHeld: jest.fn<AtlasPublicationLease['assertHeld']>(),
    release: jest.fn<AtlasPublicationLease['release']>(),
  };
  private registry: AtlasStaticRegistry = createEmptyStaticRegistry();
  private readonly now = Date.now();

  readonly given = {
    registry: (registry: AtlasStaticRegistry): this => {
      this.registry = registry;

      return this;
    },
    object: (path: string, ageMs: number): this => {
      this.storage.seed(path, '{}', {
        lastModified: new Date(this.now - ageMs).toISOString(),
      });

      return this;
    },
  };

  readonly when = {
    pruned: (previewStates: readonly AtlasArtifactPreviewState[]) =>
      pruneUnreferencedPreviewGenerations({
        storage: this.storage,
        lease: this.lease,
        registry: this.registry,
        previewStates,
        now: this.now,
      }),
  };

  readonly get = {
    removedPaths: (): readonly string[] => this.storage.removed,
  };
}
