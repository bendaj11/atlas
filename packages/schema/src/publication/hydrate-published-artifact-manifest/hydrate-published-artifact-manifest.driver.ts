import type { AtlasHostManifest } from '../../host-manifest/atlas-host-manifest.js';
import type { AtlasManifest } from '../../manifest/atlas-manifest.js';
import { hydratePublishedArtifactManifest } from './hydrate-published-artifact-manifest.js';

export class HydratePublishedArtifactManifestDriver {
  private manifest!: AtlasManifest | AtlasHostManifest;

  when = {
    hydrated: (input: { value: unknown; manifestUrl: string }): void => {
      this.manifest = hydratePublishedArtifactManifest(
        input.value,
        input.manifestUrl,
      );
    },
  };

  get = {
    manifest: (): AtlasManifest | AtlasHostManifest => this.manifest,
  };
}
