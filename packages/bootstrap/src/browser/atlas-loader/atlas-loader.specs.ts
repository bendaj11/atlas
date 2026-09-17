/** @jest-environment jsdom */
import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import { AtlasLoaderDriver } from './atlas-loader.driver.js';

describe('startAtlasLoader', () => {
  let driver: AtlasLoaderDriver;

  beforeEach(() => {
    driver = new AtlasLoaderDriver();
  });

  describe('when the page serves a runtime config and a startup catalog', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog({ hostId: runtime.hostId });
    const session = { hostId: runtime.hostId, catalog };

    beforeEach(() => {
      driver.given
        .runtimeConfig(runtime)
        .given.startupCatalog({ catalog, developmentSession: session });
    });

    describe('when started', () => {
      beforeEach(async () => {
        await driver.when.started();
      });

      it('should install the module shim when started', () => {
        expect(driver.get.installModuleShimMock()).toHaveBeenCalledTimes(1);
      });

      it('should fetch the runtime config from its well-known path when started', () => {
        expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
          url: '/atlas.runtime.json',
        });
      });

      it('should load the startup catalog for the resolved runtime when started', () => {
        expect(driver.get.loadStartupCatalogMock()).toHaveBeenCalledWith(
          expect.objectContaining({ runtime }),
        );
      });

      it('should apply overrides with the startup catalog and session when started', () => {
        expect(driver.get.applyOverridesMock()).toHaveBeenCalledWith({
          runtime,
          catalog,
          developmentSession: session,
        });
      });

      it('should validate the effective catalog against the runtime when started', () => {
        expect(driver.get.validateCatalogMock()).toHaveBeenCalledWith({
          runtime,
          catalog,
        });
      });

      it('should publish the runtime snapshot when started', () => {
        expect(driver.get.publishRuntimeSnapshotMock()).toHaveBeenCalledWith(
          expect.objectContaining({ runtime, catalog }),
        );
      });

      it('should load the host module for the effective host when started', () => {
        expect(driver.get.loadHostModuleMock()).toHaveBeenCalledWith({
          manifest: catalog.host,
          runtime,
        });
      });

      it('should clear the host root before mounting when started', () => {
        expect(driver.get.hostRootChildCount()).toBe(0);
      });

      it('should mount into the host root with the runtime and catalog when started', () => {
        expect(driver.get.mountRequest()).toEqual({
          container: driver.get.hostRoot(),
          runtimeConfig: runtime,
          catalog,
        });
      });
    });

    it('should apply overrides without a session when the startup has none', async () => {
      driver.given.startupCatalog({ catalog });
      await driver.when.started();

      expect(driver.get.applyOverridesMock()).toHaveBeenCalledWith({
        runtime,
        catalog,
      });
    });

    it('should mount the overridden catalog when overrides change it', async () => {
      const overridden = aHostCatalog({ hostId: runtime.hostId });
      driver.given.overriddenCatalog(overridden);
      await driver.when.started();

      expect(driver.get.mountRequest()?.catalog).toBe(overridden);
    });

    it('should mount through the default export when the module exposes mount there', async () => {
      const mount = async () => undefined;
      driver.given.hostModule({ default: { mount } });
      await driver.when.started();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject when the page has no host root', async () => {
      driver.given.hostRootPresent(false);
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MOUNT_FAILED',
        summary:
          'Atlas bootstrap page has no element with id="atlas-host-root".',
      });
    });

    it('should reject when the host module exports no mount function', async () => {
      driver.given.hostModule({});
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MOUNT_FAILED',
        summary: `Selected host client "${catalog.host.id}" does not export mount(request).`,
      });
    });
  });
});
