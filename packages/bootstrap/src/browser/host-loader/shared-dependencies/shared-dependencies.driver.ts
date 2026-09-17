import type { AtlasHostManifest } from '@atlas/schema';
import type {
  HostLoaderDependencies,
  RemoteMetadata,
} from '../host-loader.types.js';
import { installHostSharedDependencies } from './shared-dependencies.js';

interface AppendedElement {
  tagName: string;
  [property: string]: unknown;
}

export class SharedDependenciesDriver {
  private readonly appended: AppendedElement[] = [];
  private error: unknown;

  readonly when = {
    installed: (input: {
      metadata: RemoteMetadata;
      manifest: AtlasHostManifest;
    }): void => {
      try {
        installHostSharedDependencies({
          ...input,
          dependencies: {
            document: {
              createElement: ((tagName: string) => ({
                tagName,
              })) as Document['createElement'],
              head: {
                append: (element: AppendedElement) =>
                  this.appended.push(element),
              } as unknown as HTMLHeadElement,
            },
          } as unknown as HostLoaderDependencies,
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    appendedElements: (): readonly AppendedElement[] => this.appended,
    error: (): unknown => this.error,
  };
}
