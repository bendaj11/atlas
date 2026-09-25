import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  anAppManifest,
} from '@atlas/testkit';
import { aRegistry } from '../../testkit/registry.testkit';
import { InspectAtlasHostDriver } from './inspect-atlas-host.driver';

const { inspectAtlasHost } = await import('./inspect-atlas-host');

describe('inspectAtlasHost', () => {
  let driver: InspectAtlasHostDriver;

  beforeEach(() => {
    driver = new InspectAtlasHostDriver();
  });

  it('should reject when the catalog targets another host', async () => {
    const config = aHostRuntimeConfig();
    const catalog = aHostCatalog({ hostId: faker.string.uuid() });

    driver.given.runtimeConfig(config).given.catalog(catalog);

    await expect(
      inspectAtlasHost(faker.word.noun(), driver.get.registry()),
    ).rejects.toThrow(
      `Atlas deployment targets host ${catalog.hostId}, but runtime overrideOptions targets ${config.hostId}.`,
    );
  });

  describe('when the catalog targets the runtime host', () => {
    const config = aHostRuntimeConfig();
    const host = aHostManifest({ id: config.hostId, channel: 'production' });
    const app = anAppManifest({ channel: 'production' });
    const catalog = aHostCatalog({ hostId: config.hostId, host, apps: [app] });
    const stored = { overrides: undefined, overrideScope: undefined };

    beforeEach(() => {
      driver.given
        .runtimeConfig(config)
        .given.catalog(catalog)
        .given.storedOverrides(stored)
        .given.runtimeErrors([])
        .given.visibleAppIds([])
        .given.developmentOffers(undefined)
        .given.dismissedOfferIds({});
    });

    it('should report the page url when inspected', async () => {
      const href = faker.internet.url();

      driver.given.pageLocation(href).given.registryRoot(undefined);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .pageUrl,
      ).toBe(href);
    });

    it('should read the stored overrides under the document key and host id when inspected', async () => {
      const documentKey = faker.word.noun();

      driver.given.registryRoot(undefined);

      await inspectAtlasHost(documentKey, driver.get.registry());

      expect(driver.get.readStoredOverrides()).toHaveBeenCalledWith(
        documentKey,
        config.hostId,
      );
    });

    it('should read the development offers for the host id when inspected', async () => {
      driver.given.registryRoot(undefined);

      await inspectAtlasHost(faker.word.noun(), driver.get.registry());

      expect(driver.get.readDevelopmentOffers()).toHaveBeenCalledWith(
        config.hostId,
      );
    });

    it('should read the dismissed offer ids for the host id when inspected', async () => {
      driver.given.registryRoot(undefined);

      await inspectAtlasHost(faker.word.noun(), driver.get.registry());

      expect(driver.get.readDismissedOfferIds()).toHaveBeenCalledWith(
        config.hostId,
      );
    });

    describe('when no registry root is configured', () => {
      beforeEach(() => {
        driver.given.registryRoot(undefined);
      });

      it('should list only the deployed manifest per artifact when inspected', async () => {
        expect(
          (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
            .versions,
        ).toStrictEqual({ [host.id]: [host], [app.id]: [app] });
      });

      it('should not read the registry when inspected', async () => {
        await inspectAtlasHost(faker.word.noun(), driver.get.registry());

        expect(driver.get.readRegistry()).not.toHaveBeenCalled();
      });
    });

    describe('when a registry root is configured', () => {
      const registryRoot = faker.internet.url();
      const registry = aRegistry();

      beforeEach(() => {
        driver.given.registryRoot(registryRoot).given.registry(registry);
      });

      it('should read the registry at the root when inspected', async () => {
        driver.given
          .versions({ manifests: [host] })
          .given.versions({ manifests: [app] });

        await inspectAtlasHost(faker.word.noun(), driver.get.registry());

        expect(driver.get.readRegistry()).toHaveBeenCalledWith(registryRoot);
      });

      it('should read the versions of each deployed manifest from the registry when inspected', async () => {
        driver.given
          .versions({ manifests: [host] })
          .given.versions({ manifests: [app] });

        await inspectAtlasHost(faker.word.noun(), driver.get.registry());

        expect(driver.get.readVersions().mock.calls).toStrictEqual([
          [host, registry, registryRoot],
          [app, registry, registryRoot],
        ]);
      });

      it('should list the registry versions per artifact when the registry lists them', async () => {
        const newer = anAppManifest({ id: app.id, channel: 'production' });

        driver.given
          .versions({ manifests: [host] })
          .given.versions({ manifests: [app, newer] });

        expect(
          (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
            .versions,
        ).toStrictEqual({ [host.id]: [host], [app.id]: [app, newer] });
      });

      it('should collect the version errors when a version read reports one', async () => {
        const error = faker.lorem.sentence();

        driver.given
          .versions({ manifests: [host] })
          .given.versions({ manifests: [app], error });

        expect(
          (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
            .versionErrors,
        ).toStrictEqual([error]);
      });

      describe('when a version read fails', () => {
        const reason = faker.lorem.sentence();

        beforeEach(() => {
          driver.given
            .versions({ manifests: [host] })
            .given.versionsFailure(new Error(reason));
        });

        it('should fall back to the deployed manifest when inspected', async () => {
          expect(
            (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
              .versions,
          ).toStrictEqual({ [host.id]: [host], [app.id]: [app] });
        });

        it('should report the failure as a version error when inspected', async () => {
          expect(
            (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
              .versionErrors,
          ).toStrictEqual([reason]);
        });
      });

      describe('when the registry is unavailable', () => {
        const reason = faker.lorem.sentence();

        beforeEach(() => {
          driver.given.registryFailure(new Error(reason));
        });

        it('should keep the deployed manifests when inspected', async () => {
          expect(
            (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
              .versions,
          ).toStrictEqual({ [host.id]: [host], [app.id]: [app] });
        });

        it('should report the registry failure as a version error when inspected', async () => {
          expect(
            (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
              .versionErrors,
          ).toStrictEqual([reason]);
        });

        it('should not read versions when inspected', async () => {
          await inspectAtlasHost(faker.word.noun(), driver.get.registry());

          expect(driver.get.readVersions()).not.toHaveBeenCalled();
        });
      });
    });

    describe('when no registry root is configured and the page stores an override document', () => {
      const document = {
        schemaVersion: '1' as const,
        hostId: config.hostId,
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
      };

      beforeEach(() => {
        driver.given
          .registryRoot(undefined)
          .given.storedOverrides({ overrides: document, overrideScope: 'tab' });
      });

      it('should expose the stored document when inspected', async () => {
        expect(
          (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
            .overrides,
        ).toBe(document);
      });

      it('should expose the stored scope when inspected', async () => {
        expect(
          (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
            .overrideScope,
        ).toBe('tab');
      });
    });

    it('should have no overrides when nothing is stored', async () => {
      driver.given.registryRoot(undefined);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .overrides,
      ).toBeUndefined();
    });

    it('should expose the runtime errors when the page reports them', async () => {
      const errors = [
        { artifactId: faker.string.uuid(), message: faker.lorem.sentence() },
      ];

      driver.given.registryRoot(undefined).given.runtimeErrors(errors);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .runtimeErrors,
      ).toBe(errors);
    });

    it('should expose the visible app ids when the page renders app containers', async () => {
      const ids = [faker.string.uuid()];

      driver.given.registryRoot(undefined).given.visibleAppIds(ids);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .visibleAppIds,
      ).toBe(ids);
    });

    it('should expose the development offers when the development session offers overrides', async () => {
      const manifest = anAppManifest();
      const offers = {
        overrides: [{ appId: manifest.id, manifest, reason: 'local' as const }],
        offerIds: { [manifest.id]: faker.string.uuid() },
      };

      driver.given.registryRoot(undefined).given.developmentOffers(offers);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .developmentOffers,
      ).toBe(offers);
    });

    it('should expose the dismissed offer ids when the page stores them', async () => {
      const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

      driver.given
        .registryRoot(undefined)
        .given.dismissedOfferIds(dismissedOfferIds);

      expect(
        (await inspectAtlasHost(faker.word.noun(), driver.get.registry()))
          .dismissedOfferIds,
      ).toBe(dismissedOfferIds);
    });
  });
});
