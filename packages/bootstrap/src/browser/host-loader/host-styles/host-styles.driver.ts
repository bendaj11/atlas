import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { validateArtifactUrl } from '../../validation/index.js';
import type { HostLoaderDependencies } from '../host-loader.types.js';
import { loadHostStyles } from './host-styles.js';

interface AppendedElement {
  tagName: string;
  [property: string]: unknown;
}

export class HostStylesDriver {
  private readonly appended: AppendedElement[] = [];
  private readonly validateArtifactUrl = jest.fn<typeof validateArtifactUrl>();

  readonly when = {
    loaded: (input: {
      manifest: AtlasHostManifest;
      runtime: AtlasHostRuntimeConfig;
    }) => {
      loadHostStyles({
        ...input,
        dependencies: {
          document: {
            createElement: ((tagName: string) => ({
              tagName,
            })) as Document['createElement'],
            head: {
              append: (element: AppendedElement) => this.appended.push(element),
            } as unknown as HTMLHeadElement,
          },
          validateArtifactUrl: this.validateArtifactUrl,
        } as unknown as HostLoaderDependencies,
      });
    },
  };

  readonly get = {
    appendedElements: () => this.appended,
    validateArtifactUrlMock: () => this.validateArtifactUrl,
  };
}
