import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { validateArtifactUrl } from '../../validation/index.js';
import { loadHostStyles } from './host-styles.js';

export class HostStylesDriver {
  private readonly validateArtifactUrl = jest.fn<typeof validateArtifactUrl>();
  private removeStyles: (() => void) | undefined;
  private error: unknown;

  constructor() {
    document.head.replaceChildren();
  }

  readonly given = {
    rejectedStylesheet: (href: string) => {
      this.validateArtifactUrl.mockImplementation(({ url }) => {
        if (url.href === new URL(href).href)
          throw new Error(`Rejected ${href}`);
      });

      return this;
    },
  };

  readonly when = {
    stylesRemoved: () => this.removeStyles?.(),
    loaded: (input: {
      manifest: AtlasHostManifest;
      runtime: AtlasHostRuntimeConfig;
    }) => {
      try {
        this.removeStyles = loadHostStyles({
          ...input,
          dependencies: {
            document,
            validateArtifactUrl: this.validateArtifactUrl,
          },
        });
      } catch (error) {
        this.error = error;
      }
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

    error: () => this.error,
  };
}
