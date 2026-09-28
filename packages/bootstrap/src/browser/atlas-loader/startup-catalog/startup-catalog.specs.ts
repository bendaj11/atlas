import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import { StartupCatalogDriver } from './startup-catalog.driver.js';

describe('loadStartupCatalog', () => {
  let driver: StartupCatalogDriver;

  beforeEach(() => {
    driver = new StartupCatalogDriver();
  });

  describe('when the runtime names no development session', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();

    beforeEach(async () => {
      driver.given.runtime(runtime).given.deploymentCatalog(catalog);
      await driver.when.loaded();
    });

    it('should load the deployment catalog for the runtime when loaded', () => {
      expect(driver.get.loadDeploymentCatalogMock()).toHaveBeenCalledWith(
        expect.objectContaining({ runtime }),
      );
    });

    it('should pass onHostManifest to the deployment catalog when loaded', () => {
      expect(driver.get.loadDeploymentCatalogMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          onHostManifest: driver.get.onHostManifestMock(),
        }),
      );
    });

    it('should return the deployment catalog without a session when loaded', () => {
      expect(driver.get.result()).toEqual({ catalog });
    });

    it('should not fetch a session when loaded', () => {
      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
    });

    it('should ask the development bridge for the runtime host when loaded', () => {
      expect(driver.get.requestDevelopmentSessionMock()).toHaveBeenCalledWith({
        hostId: runtime.hostId,
      });
    });
  });

  describe('when the runtime names no development session and the development bridge answers', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog();
    const session = { hostId: runtime.hostId, overrides: [] };

    beforeEach(() => {
      driver.given
        .runtime(runtime)
        .given.deploymentCatalog(catalog)
        .given.bridgeSession(session);
    });

    it('should return the deployment catalog with the bridge session when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.result()).toEqual({
        catalog,
        developmentSession: session,
      });
    });

    it('should reject with the deployment catalog failure without waiting for the development bridge', async () => {
      const failure = new Error('deployment unavailable');
      driver.given
        .pendingBridgeSession()
        .given.deploymentCatalogFailure(failure);
      await driver.when.loaded();

      expect(driver.get.error()).toBe(failure);
    });

    it('should ignore a bridge reply that is not a development session', async () => {
      driver.given.malformedBridgeSession();
      await driver.when.loaded();

      expect(driver.get.result()).toEqual({ catalog });
    });

    it('should ask the development bridge while the deployment catalog is still loading', () => {
      driver.given.pendingDeploymentCatalog().when.loadStarted();

      expect(driver.get.requestDevelopmentSessionMock()).toHaveBeenCalled();
    });
  });

  describe('when the runtime names a development session', () => {
    const developmentSessionUrl = 'http://localhost:4400/session.json';
    const runtime = aHostRuntimeConfig({
      environment: 'development',
      developmentSessionUrl,
    });

    beforeEach(() => {
      driver.given.runtime(runtime);
    });

    it('should fetch the session from the runtime URL when loaded', async () => {
      driver.given.developmentSession({ catalog: aHostCatalog() });
      await driver.when.loaded();

      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: developmentSessionUrl,
        runtime,
      });
    });

    it('should return the session catalog with the session when loaded', async () => {
      const session = { hostId: runtime.hostId, catalog: aHostCatalog() };
      driver.given.developmentSession(session);
      await driver.when.loaded();

      expect(driver.get.result()).toEqual({
        catalog: session.catalog,
        developmentSession: session,
      });
    });

    it('should not ask the development bridge when loaded', async () => {
      driver.given.developmentSession({ catalog: aHostCatalog() });
      await driver.when.loaded();

      expect(driver.get.requestDevelopmentSessionMock()).not.toHaveBeenCalled();
    });

    it('should not load a deployment catalog when loaded', async () => {
      driver.given.developmentSession({ catalog: aHostCatalog() });
      await driver.when.loaded();

      expect(driver.get.loadDeploymentCatalogMock()).not.toHaveBeenCalled();
    });

    it('should reject when the session has no catalog', async () => {
      driver.given.developmentSession({ hostId: runtime.hostId });
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas development session at "${developmentSessionUrl}" does not include a host catalog.`,
      });
    });
  });
});
