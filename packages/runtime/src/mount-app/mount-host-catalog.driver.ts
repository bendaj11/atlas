import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type { AtlasManifest } from '@atlas/schema';
import { createTestHostSdk } from '@atlas/testkit';
import type { AtlasMountedApp } from '../host-runtime/host-runtime.types.js';
import type { FetchBytes } from '../loader/fetch-bytes.js';
import { encodeTextAsBytes } from '../shared/bytes.testkit.js';
import { installWebPlatformGlobals } from '../shared/web-platform.testkit.js';
import { loadAndMountHostCatalog } from './mount-host-catalog.js';
import type { ImportAppRemote } from './mount-app.types.js';

installWebPlatformGlobals();

export class MountHostCatalogDriver {
  readonly hostId = faker.string.uuid();
  private readonly sdk = createTestHostSdk(this.hostId);
  private readonly manifestUrl = faker.internet.url();
  private readonly responses = new Map<string, ArrayBuffer>();
  private readonly fetchBytes = jest.fn<FetchBytes>(async (url) => {
    const bytes = this.responses.get(url);

    if (!bytes) throw new Error(`Unexpected fetch: ${url}`);

    return bytes;
  });
  private readonly importRemote = jest.fn<ImportAppRemote>(async () => ({
    mount() {},
  }));
  private readonly containers = new Map<string, HTMLElement>();
  private mounted: AtlasMountedApp[] | undefined;
  private error: unknown;

  readonly given = {
    deployment: (deployment: unknown) => {
      this.responses.set(
        this.manifestUrl,
        encodeTextAsBytes(JSON.stringify(deployment)),
      );

      return this;
    },
    artifactAt: (url: string, artifact: unknown) => {
      this.responses.set(url, encodeTextAsBytes(JSON.stringify(artifact)));

      return this;
    },
    containerFor: (appId: string) => {
      this.containers.set(
        appId,
        document.body.appendChild(document.createElement('div')),
      );

      return this;
    },
  };

  readonly when = {
    mounted: async () => {
      try {
        this.mounted = await loadAndMountHostCatalog({
          hostId: this.hostId,
          sdk: this.sdk,
          manifestUrl: this.manifestUrl,
          fetchBytes: this.fetchBytes,
          importRemote: this.importRemote,
          resolveContainer: (manifest: AtlasManifest) =>
            this.containers.get(manifest.id),
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    mountedIds: () => this.mounted!.map(({ manifest }) => manifest.id),
    importRemoteMock: () => this.importRemote,
    error: () => this.error,
  };
}
