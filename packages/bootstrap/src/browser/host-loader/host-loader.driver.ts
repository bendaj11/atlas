import type { AtlasHostManifest, AtlasHostRuntimeConfig } from '@atlas/schema';
import { jest } from '@jest/globals';
import type { HostModule } from '../host-module.js';
import {
  loadHostModule,
  type HostLoaderDependencies,
  type RemoteMetadata,
} from './host-loader.js';

interface AppendedElement {
  tagName: string;
  [property: string]: unknown;
}

export class HostLoaderDriver {
  private manifest!: AtlasHostManifest;
  private runtime!: AtlasHostRuntimeConfig;
  private eventSourceSupported = true;
  private eventSource: Pick<EventSource, 'onmessage'> | undefined;
  private readonly appended: AppendedElement[] = [];
  private readonly fetchJson =
    jest.fn<(options: unknown) => Promise<unknown>>();
  private readonly importModule =
    jest.fn<HostLoaderDependencies['importModule']>();
  private readonly validateArtifactUrl =
    jest.fn<HostLoaderDependencies['validateArtifactUrl']>();
  private readonly validateHostManifest =
    jest.fn<HostLoaderDependencies['validateHostManifest']>();
  private readonly reloadPage = jest.fn();
  private module: HostModule | undefined;
  private error: unknown;

  readonly given = {
    manifest: (manifest: AtlasHostManifest): HostLoaderDriver => {
      this.manifest = manifest;

      return this;
    },
    runtime: (runtime: AtlasHostRuntimeConfig): HostLoaderDriver => {
      this.runtime = runtime;

      return this;
    },
    remoteMetadata: (metadata: RemoteMetadata): HostLoaderDriver => {
      this.fetchJson.mockResolvedValue(metadata);

      return this;
    },
    importedModule: (module: HostModule): HostLoaderDriver => {
      this.importModule.mockResolvedValue(module);

      return this;
    },
    eventSourceSupported: (supported: boolean): HostLoaderDriver => {
      this.eventSourceSupported = supported;

      return this;
    },
  };

  readonly when = {
    loaded: async (): Promise<void> => {
      try {
        this.module = await loadHostModule({
          manifest: this.manifest,
          runtime: this.runtime,
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
            fetchJson: this.fetchJson as HostLoaderDependencies['fetchJson'],
            importModule: this.importModule,
            validateArtifactUrl: this.validateArtifactUrl,
            validateHostManifest: this.validateHostManifest,
            ...(this.eventSourceSupported
              ? {
                  createEventSource: () => {
                    this.eventSource = { onmessage: null };

                    return this.eventSource;
                  },
                }
              : {}),
            reloadPage: this.reloadPage,
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
    buildNotified: (data: string): void => {
      this.eventSource?.onmessage?.call(
        this.eventSource as EventSource,
        { data } as MessageEvent<string>,
      );
    },
  };

  readonly get = {
    module: (): HostModule | undefined => this.module,
    error: (): unknown => this.error,
    appendedElements: (): readonly AppendedElement[] => this.appended,
    eventSourceCreated: (): boolean => this.eventSource !== undefined,
    fetchJsonMock: () => this.fetchJson,
    importModuleMock: () => this.importModule,
    validateArtifactUrlMock: () => this.validateArtifactUrl,
    validateHostManifestMock: () => this.validateHostManifest,
    reloadPageMock: () => this.reloadPage,
  };
}
