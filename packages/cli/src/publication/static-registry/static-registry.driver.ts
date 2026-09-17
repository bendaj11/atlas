import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import {
  createEmptyStaticRegistry,
  publishArtifact,
} from './static-registry.js';

export class StaticRegistryDriver {
  private registry?: AtlasStaticRegistry;

  readonly when = {
    emptyRegistryCreated: () => {
      this.registry = createEmptyStaticRegistry();
    },
    published: ({
      manifest,
      descriptor,
    }: {
      manifest: AtlasPublishedArtifactManifest;
      descriptor: AtlasManifestDescriptor;
    }) => {
      this.registry = publishArtifact(
        this.registry,
        manifest,
        descriptor,
      ).registry;
    },
  };

  readonly get = {
    registry: () => this.registry,
    appRelease: ({
      manifest,
      version,
    }: {
      manifest: AtlasPublishedArtifactManifest;
      version: string;
    }) => this.registry?.apps[manifest.id]?.releases[version],
  };
}
