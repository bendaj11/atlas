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
    const module = { mount: async () => undefined };

    beforeEach(() => {
      driver.given
        .runtime(runtime)
        .given.manifest(manifest)
        .given.remoteMetadata({
          exposes: [{ key: manifest.exposes.entry, outFileName }],
        })
        .given.importedModule(module);
    });

    it('should validate the host manifest against the runtime when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.validateHostManifestMock()).toHaveBeenCalledWith({
        manifest,
        runtime,
      });
    });

    it('should fetch the remote entry with the manifest integrity when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: manifest.remoteEntryUrl,
        runtime,
        integrity: manifest.integrity,
      });
    });

    it('should validate the exposed module URL when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.validateArtifactUrlMock()).toHaveBeenCalledWith({
        url: new URL(outFileName, manifest.remoteEntryUrl),
        manifest,
        runtime,
      });
    });

    it('should import the exposed module relative to the remote entry when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.importModuleMock()).toHaveBeenCalledWith({
        url: new URL(outFileName, manifest.remoteEntryUrl).href,
      });
    });

    it('should return the imported host module when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.module()).toBe(module);
    });

    it('should append nothing to the head when the remote declares no shared dependencies or styles', async () => {
      await driver.when.loaded();

      expect(driver.get.appendedElements()).toEqual([]);
    });

    it('should not watch build notifications when the remote declares no endpoint', async () => {
      await driver.when.loaded();

      expect(driver.get.eventSourceCreated()).toBe(false);
    });
  });

  describe('when the manifest declares styles', () => {
    const runtime = aHostRuntimeConfig();
    const plain = { href: faker.internet.url() };
    const verified = {
      href: faker.internet.url(),
      integrity: `sha256-${faker.string.alphanumeric(43)}=`,
    };
    const manifest = aHostManifest({ styles: [plain, verified] });

    beforeEach(async () => {
      driver.given
        .runtime(runtime)
        .given.manifest(manifest)
        .given.remoteMetadata({
          exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
        })
        .given.importedModule({});
      await driver.when.loaded();
    });

    it('should validate each stylesheet URL against the manifest when loaded', () => {
      expect(driver.get.validateArtifactUrlMock()).toHaveBeenCalledWith({
        url: new URL(verified.href),
        manifest,
        runtime,
      });
    });

    it('should append a stylesheet link without integrity when the stylesheet has none', () => {
      expect(driver.get.appendedElements()).toContainEqual({
        tagName: 'link',
        rel: 'stylesheet',
        href: plain.href,
      });
    });

    it('should append an anonymous stylesheet link with integrity when the stylesheet has one', () => {
      expect(driver.get.appendedElements()).toContainEqual({
        tagName: 'link',
        rel: 'stylesheet',
        href: verified.href,
        integrity: verified.integrity,
        crossOrigin: 'anonymous',
      });
    });
  });

  describe('when the remote declares shared dependencies', () => {
    const manifest = aHostManifest();
    const shared = {
      packageName: faker.lorem.slug(),
      outFileName: `./${faker.system.commonFileName('js')}`,
    };

    beforeEach(() => {
      driver.given.runtime(aHostRuntimeConfig()).given.manifest(manifest);
    });

    it('should append a shim import map resolving each package next to the remote entry when loaded', async () => {
      driver.given
        .remoteMetadata({
          exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
          shared: [shared],
        })
        .given.importedModule({});
      await driver.when.loaded();

      expect(driver.get.appendedElements()).toContainEqual({
        tagName: 'script',
        type: 'importmap-shim',
        textContent: JSON.stringify({
          imports: {
            [shared.packageName]: new URL(
              shared.outFileName,
              manifest.remoteEntryUrl,
            ).href,
          },
        }),
      });
    });

    it('should reject when a shared dependency lacks its file name', async () => {
      const invalid = { packageName: shared.packageName };
      driver.given.remoteMetadata({
        exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
        shared: [invalid],
      });
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_REMOTE_INVALID',
        summary: `Selected host remote entry "${manifest.remoteEntryUrl}" declares shared dependency ${JSON.stringify(invalid)} without packageName and outFileName.`,
      });
    });
  });

  describe('when the remote declares a build notifications endpoint', () => {
    const manifest = aHostManifest();

    beforeEach(() => {
      driver.given
        .runtime(aHostRuntimeConfig())
        .given.manifest(manifest)
        .given.remoteMetadata({
          exposes: [{ key: manifest.exposes.entry, outFileName: './host.js' }],
          buildNotificationsEndpoint: faker.internet.url(),
        })
        .given.importedModule({});
    });

    it('should not watch build notifications when event sources are unsupported', async () => {
      driver.given.eventSourceSupported(false);
      await driver.when.loaded();

      expect(driver.get.eventSourceCreated()).toBe(false);
    });

    describe('when event sources are supported', () => {
      beforeEach(async () => {
        driver.given.eventSourceSupported(true);
        await driver.when.loaded();
      });

      it('should reload the page when a federation rebuild completes', () => {
        driver.when.buildNotified(
          JSON.stringify({ type: 'federation-rebuild-complete' }),
        );

        expect(driver.get.reloadPageMock()).toHaveBeenCalledTimes(1);
      });

      it('should keep the page when another notification arrives', () => {
        driver.when.buildNotified(JSON.stringify({ type: faker.lorem.slug() }));

        expect(driver.get.reloadPageMock()).not.toHaveBeenCalled();
      });

      it('should keep the page when the notification is not JSON', () => {
        driver.when.buildNotified(faker.lorem.word());

        expect(driver.get.reloadPageMock()).not.toHaveBeenCalled();
      });
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
