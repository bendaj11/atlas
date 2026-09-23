import { jest } from '@jest/globals';
import type { AtlasManifest } from '@atlas/schema';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import { loadManifestStyles } from './stylesheets.js';
import type {
  AtlasStyleRelease,
  AtlasStylesheetLoadOptions,
} from './stylesheets.types.js';

export type StylesheetOutcome = 'load' | 'error';

export class StylesheetsDriver {
  private outcome: StylesheetOutcome = 'load';
  private target: ParentNode | undefined;
  private policy: AtlasRemoteTrustPolicy | undefined;
  private readonly releases: AtlasStyleRelease[] = [];
  private error: unknown;
  private readonly document = document.implementation.createHTMLDocument();
  private readonly createElement = this.document.createElement.bind(
    this.document,
  );

  constructor() {
    jest
      .spyOn(this.document, 'createElement')
      .mockImplementation(
        (tagName: string, options?: ElementCreationOptions) => {
          const element = this.createElement(tagName, options);

          if (tagName === 'link')
            queueMicrotask(() =>
              element.dispatchEvent(new Event(this.outcome)),
            );

          return element;
        },
      );
  }

  readonly given = {
    stylesheetOutcome: (outcome: StylesheetOutcome) => {
      this.outcome = outcome;

      return this;
    },
    shadowRootTarget: () => {
      this.target = this.document.body
        .appendChild(this.document.createElement('div'))
        .attachShadow({ mode: 'open' });

      return this;
    },
    policy: (policy: AtlasRemoteTrustPolicy) => {
      this.policy = policy;

      return this;
    },
  };

  readonly when = {
    loaded: async (manifest: AtlasManifest) => {
      const options: AtlasStylesheetLoadOptions = {
        ...(this.policy ? { policy: this.policy } : {}),
        ...(this.target ? { target: this.target } : {}),
      };

      try {
        this.releases.push(
          await loadManifestStyles(manifest, this.document, options),
        );
      } catch (error) {
        this.error = error;
      }
    },
    loadedWithLegacyPolicyArgument: async (manifest: AtlasManifest) => {
      try {
        this.releases.push(
          await loadManifestStyles(manifest, this.document, this.policy!),
        );
      } catch (error) {
        this.error = error;
      }
    },
    released: (index: number) => this.releases[index]!(),
  };

  readonly get = {
    headLinks: () => [...this.document.head.querySelectorAll('link')],
    targetLinks: () => [...this.target!.querySelectorAll('link')],
    error: () => this.error,
  };
}
