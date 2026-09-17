import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostManifest, anAppManifest } from '@atlas/testkit';
import { MergeDevelopmentSessionDriver } from './merge-development-session.driver.js';

describe('mergeDevelopmentSession', () => {
  let driver: MergeDevelopmentSessionDriver;

  beforeEach(() => {
    driver = new MergeDevelopmentSessionDriver();
  });

  describe('when the catalog lists an app', () => {
    const catalogApp = anAppManifest();
    const catalog = aHostCatalog({ apps: [catalogApp] });

    it('should keep the catalog host when the session has no host override', () => {
      driver.when.merged({ catalog, session: {} });

      expect(driver.get.result().host).toBe(catalog.host);
    });

    it('should select the session host override when the session has one', () => {
      const hostOverride = aHostManifest();
      driver.when.merged({ catalog, session: { hostOverride } });

      expect(driver.get.result().host).toBe(hostOverride);
    });

    it('should keep the catalog generation time when the session has none', () => {
      driver.when.merged({ catalog, session: {} });

      expect(driver.get.result().generatedAt).toBe(catalog.generatedAt);
    });

    it('should take the session generation time when the session has one', () => {
      const generatedAt = faker.date.recent().toISOString();
      driver.when.merged({ catalog, session: { generatedAt } });

      expect(driver.get.result().generatedAt).toBe(generatedAt);
    });

    it('should replace the catalog app when a session override targets it', () => {
      const manifest = anAppManifest({ id: catalogApp.id });
      driver.when.merged({
        catalog,
        session: { overrides: [{ appId: catalogApp.id, manifest }] },
      });

      expect(driver.get.result().apps).toEqual([manifest]);
    });

    it('should append the session app when it is missing from the catalog', () => {
      const manifest = anAppManifest();
      driver.when.merged({
        catalog,
        session: { overrides: [{ appId: manifest.id, manifest }] },
      });

      expect(driver.get.result().apps).toEqual([catalogApp, manifest]);
    });

    it('should ignore a session override without a manifest when merged', () => {
      driver.when.merged({
        catalog,
        session: { overrides: [{ appId: faker.string.uuid() }] },
      });

      expect(driver.get.result().apps).toEqual([catalogApp]);
    });

    it('should ignore a session override without an app id when merged', () => {
      driver.when.merged({
        catalog,
        session: { overrides: [{ manifest: anAppManifest() }] },
      });

      expect(driver.get.result().apps).toEqual([catalogApp]);
    });
  });
});
