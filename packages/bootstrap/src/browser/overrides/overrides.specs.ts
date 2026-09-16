import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aManifestDescriptor,
  anAppManifest,
  aRegistryUrl,
  aRuntimeConfig,
  aStaticRegistry,
  PUBLISHED_CHANNELS,
} from '../../testkit/manifests.testkit.js';
import { OverridesDriver } from './overrides.driver.js';

describe('applyOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  describe('when the runtime selects a host with a catalog', () => {
    const runtime = aRuntimeConfig();
    const catalogApp = anAppManifest();
    const catalog = aHostCatalog({
      host: aHostManifest({ id: runtime.hostId, channel: 'local' }),
      hostId: runtime.hostId,
      apps: [catalogApp],
    });

    beforeEach(() => {
      driver.given.runtime(runtime).given.catalog(catalog);
    });

    describe('when no development session and no stored document exist', () => {
      beforeEach(async () => {
        await driver.when.applied();
      });

      it('should ask the bridge for a development session when applied', () => {
        expect(driver.get.requestDevelopmentSessionMock()).toHaveBeenCalledWith(
          {
            hostId: runtime.hostId,
          },
        );
      });

      it('should return the catalog unchanged when applied', () => {
        expect(driver.get.result()).toBe(catalog);
      });
    });

    it('should return the catalog unchanged when the stored document targets another host', async () => {
      driver.given.sessionStorageDocument({
        hostId: faker.string.uuid(),
        overrides: [{ appId: catalogApp.id, manifest: anAppManifest() }],
      });
      await driver.when.applied();

      expect(driver.get.result()).toBe(catalog);
    });

    describe('when a development session is supplied', () => {
      const sessionApp = anAppManifest({ channel: 'local' });
      const session = {
        hostId: runtime.hostId,
        generatedAt: faker.date.recent().toISOString(),
        hostOverride: aHostManifest({ id: runtime.hostId, channel: 'local' }),
        overrides: [
          {
            appId: catalogApp.id,
            manifest: anAppManifest({ id: catalogApp.id, channel: 'local' }),
          },
          { appId: sessionApp.id, manifest: sessionApp },
        ],
      };

      beforeEach(async () => {
        driver.given.suppliedSession(session);
        await driver.when.applied();
      });

      it('should not fetch a session when applied', () => {
        expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
      });

      it('should not ask the bridge for a session when applied', () => {
        expect(
          driver.get.requestDevelopmentSessionMock(),
        ).not.toHaveBeenCalled();
      });

      it('should store the session document in session storage when applied', () => {
        expect(driver.get.storedSessionDocument()).toEqual(session);
      });

      it('should select the session host override when applied', () => {
        expect(driver.get.result()?.host).toEqual(session.hostOverride);
      });

      it('should replace the catalog app with the session override when applied', () => {
        expect(driver.get.result()?.apps).toContainEqual(
          session.overrides[0]!.manifest,
        );
      });

      it('should append the session app missing from the catalog when applied', () => {
        expect(driver.get.result()?.apps).toContainEqual(sessionApp);
      });

      it('should take the session generation time when applied', () => {
        expect(driver.get.result()?.generatedAt).toBe(session.generatedAt);
      });
    });

    it('should fetch the development session when the runtime names a session URL', async () => {
      const developmentSessionUrl = 'http://localhost:4400/session.json';
      const sessionRuntime = aRuntimeConfig({
        hostId: runtime.hostId,
        developmentSessionUrl,
      });
      driver.given
        .runtime(sessionRuntime)
        .given.fetchedSession({ hostId: runtime.hostId, overrides: [] });
      await driver.when.applied();

      expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
        url: developmentSessionUrl,
        runtime: sessionRuntime,
      });
    });

    it('should merge the bridge session when the bridge replies', async () => {
      const hostOverride = aHostManifest({
        id: runtime.hostId,
        channel: 'local',
      });
      driver.given.bridgeSession({ hostId: runtime.hostId, hostOverride });
      await driver.when.applied();

      expect(driver.get.result()?.host).toEqual(hostOverride);
    });

    describe('when a stored document targets this host', () => {
      it('should read the document from local storage when session storage is empty', async () => {
        const hostOverride = aHostManifest({
          id: runtime.hostId,
          channel: 'local',
        });
        driver.given.localStorageDocument({
          hostId: runtime.hostId,
          hostOverride,
        });
        await driver.when.applied();

        expect(driver.get.result()?.host).toEqual(hostOverride);
      });

      it('should select the legacy host manifest when the document nests it under host', async () => {
        const manifest = aHostManifest({
          id: runtime.hostId,
          channel: 'local',
        });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          host: { manifest },
        });
        await driver.when.applied();

        expect(driver.get.result()?.host).toEqual(manifest);
      });

      it('should replace the catalog app when an override targets it', async () => {
        const manifest = anAppManifest({ id: catalogApp.id, channel: 'local' });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: catalogApp.id, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.result()?.apps).toEqual([manifest]);
      });

      it('should honor the legacy apps list when the document uses it', async () => {
        const manifest = anAppManifest({ id: catalogApp.id, channel: 'local' });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          apps: [{ appId: catalogApp.id, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.result()?.apps).toEqual([manifest]);
      });

      it('should add a widget provider when an override targets an external dependency', async () => {
        const providerId = faker.string.uuid();
        const dependent = anAppManifest({
          externalAppsDependencies: [providerId],
        });
        const provider = anAppManifest({ id: providerId, channel: 'local' });
        driver.given
          .catalog(aHostCatalog({ ...catalog, apps: [dependent] }))
          .given.sessionStorageDocument({
            hostId: runtime.hostId,
            overrides: [{ appId: providerId, manifest: provider }],
          });
        await driver.when.applied();

        expect(driver.get.result()?.widgetProviders).toEqual([provider]);
      });

      it('should add a local app when an override targets an app outside the catalog', async () => {
        const manifest = anAppManifest({ channel: 'local' });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: manifest.id, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.result()?.apps).toEqual([catalogApp, manifest]);
      });

      it('should reject when a published override targets an app outside the catalog', async () => {
        const manifest = anAppManifest({
          channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
        });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: manifest.id, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.error()).toMatchObject({
          code: 'OVERRIDE_INVALID',
          summary: `Atlas app override "${manifest.id}" (${manifest.channel}) targets neither a catalog app nor an external widget provider of host "${runtime.hostId}".`,
        });
      });

      it('should reject when an override has no manifest', async () => {
        const appId = faker.string.uuid();
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId }],
        });
        await driver.when.applied();

        expect(driver.get.error()).toMatchObject({
          code: 'OVERRIDE_INVALID',
          summary: `Atlas app override for "${appId}" has no manifest.`,
        });
      });

      it('should reject when an override carries a host manifest', async () => {
        const manifest = aHostManifest();
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: manifest.id, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.error()).toMatchObject({
          code: 'OVERRIDE_INVALID',
          summary: `Atlas app override for "${manifest.id}" carries a host manifest instead of an app manifest.`,
        });
      });

      it('should reject when an override manifest belongs to another app', async () => {
        const appId = faker.string.uuid();
        const manifest = anAppManifest({ channel: 'local' });
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId, manifest }],
        });
        await driver.when.applied();

        expect(driver.get.error()).toMatchObject({
          code: 'OVERRIDE_INVALID',
          summary: `Atlas app override for "${appId}" carries a manifest for app "${manifest.id}".`,
        });
      });
    });

    describe('when a published override lives under a registry', () => {
      const registryRoot = aRegistryUrl();
      const stored = anAppManifest({
        id: catalogApp.id,
        channel: 'production',
        remoteEntryUrl: `${registryRoot}/apps/${catalogApp.id}/${faker.system.semver()}/remoteEntry.json`,
      });
      const descriptor = aManifestDescriptor();

      beforeEach(() => {
        driver.given.sessionStorageDocument({
          hostId: runtime.hostId,
          overrides: [{ appId: stored.id, manifest: stored }],
        });
      });

      it('should fetch the registry index from the registry root when applied', async () => {
        driver.given.registry(aStaticRegistry());
        await driver.when.applied();

        expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
          url: `${registryRoot}/registry.json`,
          runtime,
        });
      });

      it('should keep the stored manifest when the registry does not list the app', async () => {
        driver.given.registry(aStaticRegistry());
        await driver.when.applied();

        expect(driver.get.result()?.apps).toEqual([stored]);
      });

      it('should keep the stored manifest when the registry cannot be fetched', async () => {
        driver.given.registryFailure(new Error(faker.lorem.sentence()));
        await driver.when.applied();

        expect(driver.get.result()?.apps).toEqual([stored]);
      });

      describe('when the registry lists the stored release', () => {
        beforeEach(() => {
          driver.given.registry(
            aStaticRegistry({
              apps: {
                [stored.id]: {
                  id: stored.id,
                  name: stored.name,
                  releases: { [stored.version]: descriptor },
                  previews: {},
                },
              },
            }),
          );
        });

        it('should load the published artifact from the registry root when applied', async () => {
          driver.given.publishedArtifact(anAppManifest({ id: stored.id }));
          await driver.when.applied();

          expect(driver.get.loadPublishedArtifactMock()).toHaveBeenCalledWith({
            reference: {
              ...descriptor,
              url: `${registryRoot}/${descriptor.path}`,
            },
            runtime,
          });
        });

        it('should use the published manifest when its kind matches', async () => {
          const published = anAppManifest({ id: stored.id });
          driver.given.publishedArtifact(published);
          await driver.when.applied();

          expect(driver.get.result()?.apps).toEqual([published]);
        });

        it('should reject when the published artifact fails verification', async () => {
          const failure = new Error(faker.lorem.sentence());
          driver.given.publishedArtifactFailure(failure);
          await driver.when.applied();

          expect(driver.get.error()).toBe(failure);
        });

        it('should keep the stored manifest when the published kind differs', async () => {
          driver.given.publishedArtifact(aHostManifest({ id: stored.id }));
          await driver.when.applied();

          expect(driver.get.result()?.apps).toEqual([stored]);
        });
      });

      it('should load the preview artifact when the stored manifest names a PR', async () => {
        const prNumber = faker.number.int({ min: 1, max: 9999 });
        const preview = anAppManifest({
          ...stored,
          channel: 'pr',
          prNumber,
        });
        const previewDescriptor = aManifestDescriptor();
        driver.given
          .sessionStorageDocument({
            hostId: runtime.hostId,
            overrides: [{ appId: preview.id, manifest: preview }],
          })
          .given.registry(
            aStaticRegistry({
              apps: {
                [preview.id]: {
                  id: preview.id,
                  name: preview.name,
                  releases: {},
                  previews: { [String(prNumber)]: previewDescriptor },
                },
              },
            }),
          )
          .given.publishedArtifact(anAppManifest({ id: preview.id }));
        await driver.when.applied();

        expect(driver.get.loadPublishedArtifactMock()).toHaveBeenCalledWith({
          reference: {
            ...previewDescriptor,
            url: `${registryRoot}/${previewDescriptor.path}`,
          },
          runtime,
        });
      });
    });

    it('should keep a published override without a registry marker when applied', async () => {
      const manifest = anAppManifest({
        id: catalogApp.id,
        channel: 'production',
      });
      driver.given.sessionStorageDocument({
        hostId: runtime.hostId,
        overrides: [{ appId: manifest.id, manifest }],
      });
      await driver.when.applied();

      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
    });
  });
});
