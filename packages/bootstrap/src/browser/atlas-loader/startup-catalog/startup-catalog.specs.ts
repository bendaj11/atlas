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

    it('should return the deployment catalog without a session when loaded', () => {
      expect(driver.get.result()).toEqual({ catalog });
    });

    it('should not fetch a session when loaded', () => {
      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
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
