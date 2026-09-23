import { jest } from '@jest/globals';
import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import type {
  AtlasAppEntry,
  AtlasExportedWidgetEntry,
} from '@atlas/sdk/lifecycle';
import {
  createNativeFederationImporters,
  createTrustedNativeFederationImporters,
} from './native-federation.js';
import type {
  AtlasNativeFederationImporters,
  InitFederation,
  LoadRemoteModule,
} from './native-federation.types.js';
import type { AtlasRemoteTrustPolicy } from './trust/trust-policy.types.js';

const REQUEST_POLICY = { retryCount: 0, timeoutMs: 50 };

export class NativeFederationDriver {
  private readonly initFederation = jest
    .fn<InitFederation>()
    .mockResolvedValue(undefined);
  private readonly loadRemoteModule = jest
    .fn<LoadRemoteModule>()
    .mockResolvedValue({ mount() {} });
  private hostRemoteEntryUrl: string | undefined;
  private retryCount = 0;
  private importers: AtlasNativeFederationImporters | undefined;
  private entry: AtlasAppEntry | AtlasExportedWidgetEntry | undefined;
  private error: unknown;

  readonly given = {
    hostRemoteEntryUrl: (url: string) => {
      this.hostRemoteEntryUrl = url;

      return this;
    },
    retryCount: (retryCount: number) => {
      this.retryCount = retryCount;

      return this;
    },
    initializationFailingFor: (remoteName: string, error: Error) => {
      this.initFederation.mockImplementation(async (remotes) => {
        if (remoteName in remotes) throw error;
      });

      return this;
    },
    initializationFailingOnce: (error: Error) => {
      this.initFederation.mockRejectedValueOnce(error);

      return this;
    },
    moduleLoadResults: (results: Array<unknown | Error>) => {
      for (const result of results) {
        if (result instanceof Error)
          this.loadRemoteModule.mockRejectedValueOnce(result);
        else this.loadRemoteModule.mockResolvedValueOnce(result);
      }

      return this;
    },
    importers: () => {
      this.importers = createNativeFederationImporters({
        runtime: this.adapter(),
        requestPolicy: { ...REQUEST_POLICY, retryCount: this.retryCount },
        ...(this.hostRemoteEntryUrl
          ? { hostRemoteEntryUrl: this.hostRemoteEntryUrl }
          : {}),
      });

      return this;
    },
    trustedImporters: async (
      manifests: AtlasManifest[],
      policy: AtlasRemoteTrustPolicy = {},
    ) => {
      this.importers = await createTrustedNativeFederationImporters({
        runtime: this.adapter(),
        manifests,
        policy,
        requestPolicy: { ...REQUEST_POLICY, retryCount: this.retryCount },
      });

      return this;
    },
  };

  readonly when = {
    initialized: (manifests: AtlasManifest[]) =>
      this.importers!.initialize(manifests),
    remoteImported: async (manifest: AtlasManifest) => {
      this.error = undefined;

      try {
        this.entry = await this.importers!.importRemote(manifest);
      } catch (error) {
        this.error = error;
      }
    },
    widgetImported: async (
      widget: AtlasExportedWidgetManifest,
      ownerManifest?: AtlasManifest,
    ) => {
      this.error = undefined;

      try {
        this.entry = await this.importers!.importWidget(widget, ownerManifest);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    entry: () => this.entry,
    error: () => this.error,
    initFederationMock: () => this.initFederation,
    loadRemoteModuleMock: () => this.loadRemoteModule,
    initializedRemotes: () =>
      this.initFederation.mock.calls.map(([remotes]) => remotes),
  };

  private adapter() {
    return {
      initFederation: this.initFederation,
      loadRemoteModule: this.loadRemoteModule,
    };
  }
}
