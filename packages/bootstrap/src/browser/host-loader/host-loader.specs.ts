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

    it('should fetch the remote entry with the manifest integrity when loaded', () => {
      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: manifest.remoteEntryUrl,
        runtime,
        integrity: manifest.integrity,
      });
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
});
