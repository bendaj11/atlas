import type { AtlasRegistryArtifact } from '@atlas/schema';
import { aStaticRegistry } from '@atlas/testkit/internal';
import {
  resolveRegistryArtifact,
  resolveRelease,
} from './artifact-resolution.js';

export class ArtifactResolutionDriver {
  private readonly registry = aStaticRegistry();

  readonly given = {
    app: (artifact: AtlasRegistryArtifact) => {
      this.registry.apps[artifact.id] = artifact;

      return this;
    },
    host: (artifact: AtlasRegistryArtifact) => {
      this.registry.hosts[artifact.id] = artifact;

      return this;
    },
  };

  readonly get = {
    artifact: (identifier: string) =>
      resolveRegistryArtifact(this.registry, identifier),
    release: (identifier: string, selector: string) =>
      resolveRelease(this.registry, identifier, selector),
  };
}
