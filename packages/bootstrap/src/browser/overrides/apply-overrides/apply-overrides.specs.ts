/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  anAppManifest,
} from '@atlas/testkit';
import { ApplyOverridesDriver } from './apply-overrides.driver.js';

const { applyOverrides } = await import('./apply-overrides.js');

describe('applyOverrides', () => {
  let driver: ApplyOverridesDriver;

  beforeEach(() => {
    driver = new ApplyOverridesDriver();
  });

  describe('when the runtime selects a host with a catalog and names no development session URL', () => {
    const runtime = aHostRuntimeConfig({ developmentSessionUrl: undefined });
    const catalog = aHostCatalog({ hostId: runtime.hostId });

    it('should return the catalog unchanged when no session is discovered and nothing is stored', async () => {
      await expect(
        applyOverrides({
          runtime,
          catalog,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(catalog);
    });

    it('should not discover a session when one is supplied', async () => {
      await applyOverrides({
        runtime,
        catalog,
        developmentSession: { hostId: runtime.hostId, overrides: [] },
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.requestDevelopmentSessionMock()).not.toHaveBeenCalled();
    });

    it('should apply the offered overrides when the discovered session offers them', async () => {
      const manifest = anAppManifest({ channel: 'local' });
      const offered = { appId: manifest.id, manifest };

      driver.given.bridgeSession({
        hostId: runtime.hostId,
        overrides: [offered],
        offerIds: { [manifest.id]: faker.date.past().toISOString() },
      });

      await applyOverrides({
        runtime,
        catalog,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.applyOverridesDocumentMock()).toHaveBeenCalledWith(
        expect.objectContaining({ catalog, overrides: { overrides: [offered] } }),
      );
    });

    it('should return the catalog unchanged when every offer was dismissed for every tab', async () => {
      const manifest = anAppManifest({ channel: 'local' });
      const offerId = faker.date.past().toISOString();

      driver.given
        .bridgeSession({
          hostId: runtime.hostId,
          overrides: [{ appId: manifest.id, manifest }],
          offerIds: { [manifest.id]: offerId },
        })
        .given.originDismissedOffers(runtime.hostId, { [manifest.id]: offerId });

      await expect(
        applyOverrides({
          runtime,
          catalog,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(catalog);
    });

    it('should apply the offered host override when the session offers a host', async () => {
      const hostOverride = aHostManifest({ id: runtime.hostId });

      driver.given.bridgeSession({
        hostId: runtime.hostId,
        overrides: [],
        hostOverride,
        offerIds: { [hostOverride.id]: faker.date.past().toISOString() },
      });

      await applyOverrides({
        runtime,
        catalog,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.applyOverridesDocumentMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          catalog,
          overrides: { overrides: [], hostOverride },
        }),
      );
    });

    it('should apply the stored overrides with the offered ones when both exist', async () => {
      const storedManifest = anAppManifest({ channel: 'production' });
      const offeredManifest = anAppManifest({ channel: 'local' });
      const stored = { appId: storedManifest.id, manifest: storedManifest };
      const offered = { appId: offeredManifest.id, manifest: offeredManifest };

      driver.given
        .bridgeSession({
          hostId: runtime.hostId,
          overrides: [offered],
          offerIds: { [offeredManifest.id]: faker.date.past().toISOString() },
        })
        .given.originDocument({ hostId: runtime.hostId, overrides: [stored] });

      await applyOverrides({
        runtime,
        catalog,
        dependencies: driver.get.dependencies(),
      });

      expect(driver.get.applyOverridesDocumentMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          catalog,
          overrides: { overrides: [stored, offered] },
        }),
      );
    });

    it('should return the catalog unchanged when the stored document targets another host', async () => {
      const manifest = anAppManifest({ channel: 'production' });

      driver.given.tabDocument({
        hostId: faker.string.uuid(),
        overrides: [{ appId: manifest.id, manifest }],
      });

      await expect(
        applyOverrides({
          runtime,
          catalog,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(catalog);
    });

    it('should return the overridden catalog when the stored document targets this host', async () => {
      const manifest = anAppManifest({ channel: 'production' });
      const overridden = aHostCatalog({ hostId: runtime.hostId });

      driver.given
        .tabDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: manifest.id, manifest }],
        })
        .given.overriddenCatalog(overridden);

      await expect(
        applyOverrides({
          runtime,
          catalog,
          dependencies: driver.get.dependencies(),
        }),
      ).resolves.toBe(overridden);
    });
  });
});
