import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostRuntimeConfig } from '@atlas/testkit';
import { ApplyOverridesDriver } from './apply-overrides.driver.js';

describe('applyOverrides', () => {
  let driver: ApplyOverridesDriver;

  beforeEach(() => {
    driver = new ApplyOverridesDriver();
  });

  describe('when the runtime selects a host with a catalog', () => {
    const runtime = aHostRuntimeConfig();
    const catalog = aHostCatalog({ hostId: runtime.hostId });

    beforeEach(() => {
      driver.given.runtime(runtime).given.catalog(catalog);
    });

    describe('when no session is supplied or discovered and nothing is stored', () => {
      beforeEach(async () => {
        await driver.when.applied();
      });

      it('should discover a development session for the runtime when applied', () => {
        expect(
          driver.get.discoverDevelopmentSessionMock(),
        ).toHaveBeenCalledWith(expect.objectContaining({ runtime }));
      });

      it('should return the catalog unchanged when applied', () => {
        expect(driver.get.result()).toBe(catalog);
      });

      it('should not merge a session when applied', () => {
        expect(driver.get.mergeDevelopmentSessionMock()).not.toHaveBeenCalled();
      });
    });

    describe('when a session is supplied', () => {
      const session = { hostId: runtime.hostId };
      const merged = aHostCatalog({ hostId: runtime.hostId });

      beforeEach(async () => {
        driver.given.suppliedSession(session).given.mergedCatalog(merged);
        await driver.when.applied();
      });

      it('should not discover a session when applied', () => {
        expect(
          driver.get.discoverDevelopmentSessionMock(),
        ).not.toHaveBeenCalled();
      });

      it('should store the supplied session when applied', () => {
        expect(driver.get.storeDevelopmentSessionMock()).toHaveBeenCalledWith(
          expect.objectContaining({ session }),
        );
      });

      it('should merge the supplied session into the catalog when applied', () => {
        expect(driver.get.mergeDevelopmentSessionMock()).toHaveBeenCalledWith({
          catalog,
          session,
        });
      });

      it('should apply the stored session document to the merged catalog when applied', () => {
        expect(driver.get.applyOverridesDocumentMock()).toHaveBeenCalledWith(
          expect.objectContaining({ catalog: merged, overrides: session }),
        );
      });
    });

    describe('when a session already seeded in this tab is supplied', () => {
      const session = { hostId: runtime.hostId };
      const overridden = aHostCatalog({ hostId: runtime.hostId });
      const stored = { hostId: runtime.hostId };

      beforeEach(async () => {
        driver.given
          .suppliedSession(session)
          .given.sessionSeeded(true)
          .given.storedDocument(stored)
          .given.overriddenCatalog(overridden);
        await driver.when.applied();
      });

      it('should not store the session again when applied', () => {
        expect(driver.get.storeDevelopmentSessionMock()).not.toHaveBeenCalled();
      });

      it('should not merge the session when applied', () => {
        expect(driver.get.mergeDevelopmentSessionMock()).not.toHaveBeenCalled();
      });

      it('should apply the stored document to the catalog when applied', () => {
        expect(driver.get.applyOverridesDocumentMock()).toHaveBeenCalledWith(
          expect.objectContaining({ catalog, overrides: stored }),
        );
      });
    });

    it('should merge the discovered session when one is discovered', async () => {
      const session = { hostId: runtime.hostId };
      driver.given.discoveredSession(session).given.mergedCatalog(catalog);
      await driver.when.applied();

      expect(driver.get.mergeDevelopmentSessionMock()).toHaveBeenCalledWith({
        catalog,
        session,
      });
    });

    it('should return the catalog unchanged when the stored document targets another host', async () => {
      driver.given.storedDocument({ hostId: faker.string.uuid() });
      await driver.when.applied();

      expect(driver.get.result()).toBe(catalog);
    });

    it('should return the overridden catalog when the stored document targets this host', async () => {
      const overridden = aHostCatalog({ hostId: runtime.hostId });
      driver.given
        .storedDocument({ hostId: runtime.hostId })
        .given.overriddenCatalog(overridden);
      await driver.when.applied();

      expect(driver.get.result()).toBe(overridden);
    });
  });
});
