import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { validateArtifactUrl } from '../../validation/index.js';
import { loadHostStyles } from './host-styles.js';

export class HostStylesDriver {
  private readonly validateArtifactUrl = jest.fn<typeof validateArtifactUrl>();

  constructor() {
    document.head.replaceChildren();
  }

  readonly when = {
    loaded: (input: {
      manifest: AtlasHostManifest;
      runtime: AtlasHostRuntimeConfig;
    }) => {
      loadHostStyles({
        ...input,
        dependencies: {
          document,
          validateArtifactUrl: this.validateArtifactUrl,
        },
      });
    },
  };

  readonly get = {
    stylesheetLinks: () =>
      Array.from(document.head.querySelectorAll('link'), (link) => ({
        rel: link.rel,
        href: link.getAttribute('href'),
        integrity: link.integrity,
        crossOrigin: link.getAttribute('crossorigin'),
      })),
    validateArtifactUrlMock: () => this.validateArtifactUrl,
  };
}
