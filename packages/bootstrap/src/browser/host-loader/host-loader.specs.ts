import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { aHostManifest, aHostRuntimeConfig } from '@atlas/testkit';
import { HostLoaderDriver } from './host-loader.driver.js';

describe('loadHostModule', () => {
  let driver: HostLoaderDriver;

  beforeEach(() => {
    driver = new HostLoaderDriver();
  });

  describe('when the remote entry exposes the host entry', () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest({
      integrity: `sha256-${faker.string.alphanumeric(43)}=`,
    });
    const outFileName = `./${faker.system.commonFileName('js')}`;
    const metadata = {
      exposes: [{ key: manifest.exposes.entry, outFileName }],
    };
    const module = { mount: async () => undefined };

    beforeEach(async () => {
      driver.given
        .runtime(runtime)
        .given.manifest(manifest)
        .given.remoteMetadata(metadata)
        .given.importedModule(module);
      await driver.when.loaded();
    });

    it('should validate the host manifest against the runtime when loaded', () => {
      expect(driver.get.validateHostManifestMock()).toHaveBeenCalledWith({
        manifest,
        runtime,
      });
    });

    it('should fetch the remote entry with a verification step when loaded', () => {
      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: manifest.remoteEntryUrl,
        runtime,
        verify: expect.any(Function),
      });
    });

    it('should reject remote entry bytes that do not match the manifest integrity', async () => {
      const verify = driver.get.remoteEntryVerification();

      await expect(
        verify?.(
          Uint8Array.from(faker.string.alphanumeric(24), (character) =>
            character.charCodeAt(0),
          ),
        ),
      ).rejects.toMatchObject({ code: 'ARTIFACT_VERIFICATION_FAILED' });
    });

    it('should load the host styles before fetching the remote entry', () => {
      expect(
        driver.get.loadHostStylesMock().mock.invocationCallOrder[0],
      ).toBeLessThan(driver.get.fetchJsonMock().mock.invocationCallOrder[0]!);
    });

    it('should watch build notifications for the remote when loaded', () => {
      expect(driver.get.watchHostBuildNotificationsMock()).toHaveBeenCalledWith(
        expect.objectContaining({ metadata, manifest }),
      );
    });

    it('should install the shared dependencies of the remote when loaded', () => {
      expect(
        driver.get.installHostSharedDependenciesMock(),
      ).toHaveBeenCalledWith(expect.objectContaining({ metadata, manifest }));
    });

    it('should load the host styles when loaded', () => {
      expect(driver.get.loadHostStylesMock()).toHaveBeenCalledWith(
        expect.objectContaining({ manifest, runtime }),
      );
    });

    it('should validate the exposed module URL when loaded', () => {
      expect(driver.get.validateArtifactUrlMock()).toHaveBeenCalledWith({
        url: new URL(outFileName, manifest.remoteEntryUrl),
        manifest,
        runtime,
      });
    });

    it('should import the exposed module relative to the remote entry when loaded', () => {
      expect(driver.get.importModuleMock()).toHaveBeenCalledWith({
        url: new URL(outFileName, manifest.remoteEntryUrl).href,
      });
    });

    it('should return the imported host module when loaded', () => {
      expect(driver.get.module()).toBe(module);
    });
  });

  it('should fetch the remote entry without integrity when the manifest has none', async () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest();
    driver.given
      .runtime(runtime)
      .given.manifest(manifest)
      .given.remoteMetadata({
        exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
      })
      .given.importedModule({});
    await driver.when.loaded();

    expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
      url: manifest.remoteEntryUrl,
      runtime,
    });
  });

  it('should accept remote entry bytes that match the manifest integrity', async () => {
    const bytes = Uint8Array.from(faker.string.alphanumeric(24), (character) =>
      character.charCodeAt(0),
    );
    const manifest = aHostManifest({
      integrity: `sha256-${createHash('sha256').update(bytes).digest('base64')}`,
    });
    driver.given
      .runtime(aHostRuntimeConfig())
      .given.manifest(manifest)
      .given.remoteMetadata({ exposes: [] });
    await driver.when.loaded();

    await expect(
      driver.get.remoteEntryVerification()?.(bytes),
    ).resolves.toBeUndefined();
  });

  it('should remove the host stylesheets when the host entry cannot be loaded', async () => {
    const manifest = aHostManifest();
    driver.given
      .runtime(aHostRuntimeConfig())
      .given.manifest(manifest)
      .given.remoteMetadata({ exposes: [] });
    await driver.when.loaded();

    expect(driver.get.removeHostStylesMock()).toHaveBeenCalled();
  });

  it('should keep the host stylesheets when the host entry loads', async () => {
    const manifest = aHostManifest();
    driver.given
      .runtime(aHostRuntimeConfig())
      .given.manifest(manifest)
      .given.remoteMetadata({
        exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
      })
      .given.importedModule({});
    await driver.when.loaded();

    expect(driver.get.removeHostStylesMock()).not.toHaveBeenCalled();
  });

  it('should reject when the remote entry does not expose the host entry', async () => {
    const manifest = aHostManifest();
    driver.given
      .runtime(aHostRuntimeConfig())
      .given.manifest(manifest)
      .given.remoteMetadata({ exposes: [] });
    await driver.when.loaded();

    expect(driver.get.error()).toMatchObject({
      code: 'HOST_REMOTE_INVALID',
      summary: `Selected host remote entry "${manifest.remoteEntryUrl}" does not expose "${manifest.exposes.entry}".`,
    });
  });

  describe('when a prefetched remote entry of the same remote entry url and integrity is given', () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest();
    const module = { mount: async () => undefined };

    beforeEach(async () => {
      driver.given
        .runtime(runtime)
        .given.manifest(manifest)
        .given.prefetchedRemoteEntry({
          manifest,
          metadata: Promise.resolve({
            exposes: [
              {
                key: manifest.exposes.entry,
                outFileName: `./${faker.system.commonFileName('js')}`,
              },
            ],
          }),
        })
        .given.importedModule(module);
      await driver.when.loaded();
    });

    it('should not fetch the remote entry when loaded', () => {
      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
    });

    it('should return the host module imported from the prefetched remote entry when loaded', () => {
      expect(driver.get.module()).toBe(module);
    });
  });

  it('should fetch the remote entry when the prefetched remote entry has another remote entry url', async () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest();
    const metadata = {
      exposes: [
        {
          key: manifest.exposes.entry,
          outFileName: `./${faker.system.commonFileName('js')}`,
        },
      ],
    };

    driver.given
      .runtime(runtime)
      .given.manifest(manifest)
      .given.prefetchedRemoteEntry({
        manifest: aHostManifest(),
        metadata: Promise.resolve(metadata),
      })
      .given.remoteMetadata(metadata)
      .given.importedModule({ mount: async () => undefined });
    await driver.when.loaded();

    expect(driver.get.fetchJsonMock()).toHaveBeenCalledTimes(1);
  });

  it('should fetch the remote entry when the prefetched remote entry has another integrity', async () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest({
      integrity: `sha256-${faker.string.alphanumeric(43)}=`,
    });
    const metadata = {
      exposes: [
        {
          key: manifest.exposes.entry,
          outFileName: `./${faker.system.commonFileName('js')}`,
        },
      ],
    };

    driver.given
      .runtime(runtime)
      .given.manifest(manifest)
      .given.prefetchedRemoteEntry({
        manifest: {
          ...manifest,
          integrity: `sha256-${faker.string.alphanumeric(43)}=`,
        },
        metadata: Promise.resolve(metadata),
      })
      .given.remoteMetadata(metadata)
      .given.importedModule({ mount: async () => undefined });
    await driver.when.loaded();

    expect(driver.get.fetchJsonMock()).toHaveBeenCalledTimes(1);
  });

  it('should fetch the remote entry again when the prefetched remote entry failed', async () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest();
    const failed = Promise.reject(new Error(faker.lorem.sentence()));
    failed.catch(() => undefined);

    driver.given
      .runtime(runtime)
      .given.manifest(manifest)
      .given.prefetchedRemoteEntry({ manifest, metadata: failed })
      .given.remoteMetadata({
        exposes: [
          {
            key: manifest.exposes.entry,
            outFileName: `./${faker.system.commonFileName('js')}`,
          },
        ],
      })
      .given.importedModule({ mount: async () => undefined });
    await driver.when.loaded();

    expect(driver.get.fetchJsonMock()).toHaveBeenCalledTimes(1);
  });
});

describe('prefetchHostRemoteEntry', () => {
  let driver: HostLoaderDriver;

  beforeEach(() => {
    driver = new HostLoaderDriver();
  });

  describe('when the host manifest is valid', () => {
    const runtime = aHostRuntimeConfig();
    const manifest = aHostManifest({
      integrity: `sha256-${faker.string.alphanumeric(43)}=`,
    });
    const metadata = {
      exposes: [
        {
          key: manifest.exposes.entry,
          outFileName: `./${faker.system.commonFileName('js')}`,
        },
      ],
    };

    beforeEach(() => {
      driver.given
        .runtime(runtime)
        .given.manifest(manifest)
        .given.remoteMetadata(metadata);
      driver.when.prefetched();
    });

    it('should fetch the remote entry with a verification step when prefetched', () => {
      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: manifest.remoteEntryUrl,
        runtime,
        verify: expect.any(Function),
      });
    });

    it('should resolve the prefetched remote entry to the fetched metadata when prefetched', async () => {
      await expect(driver.get.prefetchedRemoteEntry()?.metadata).resolves.toBe(
        metadata,
      );
    });
  });

  describe('when the host manifest is rejected', () => {
    beforeEach(() => {
      driver.given
        .runtime(aHostRuntimeConfig())
        .given.manifest(aHostManifest())
        .given.hostManifestRejection(new Error(faker.lorem.sentence()));
      driver.when.prefetched();
    });

    it('should not fetch the remote entry when prefetched', () => {
      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
    });

    it('should return no prefetched remote entry when prefetched', () => {
      expect(driver.get.prefetchedRemoteEntry()).toBeUndefined();
    });
  });
});
