import type { AtlasHostManifest } from '@atlas/schema';
import type { RemoteMetadata } from '../host-loader.types.js';
import { installHostSharedDependencies } from './shared-dependencies.js';

export class SharedDependenciesDriver {
  private error: unknown;

  constructor() {
    document.head.replaceChildren();
  }

  readonly when = {
    installed: (input: {
      metadata: RemoteMetadata;
      manifest: AtlasHostManifest;
    }) => {
      try {
        installHostSharedDependencies({
          ...input,
          dependencies: { document },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    importMapScripts: () =>
      Array.from(document.head.querySelectorAll('script'), (script) => ({
        type: script.type,
        textContent: script.textContent,
      })),
    error: () => this.error,
  };
}
