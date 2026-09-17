import { faker } from '@faker-js/faker';
import {
  aHostManifest,
  aHostRuntimeConfig,
  aManifestDescriptor,
  anAppManifest,
  aRegistryUrl,
  aStaticRegistry,
  PUBLISHED_CHANNELS,
} from '@atlas/testkit';
import { ResolveOverrideManifestDriver } from './resolve-override-manifest.driver.js';

describe('resolveOverrideManifest', () => {
  let driver: ResolveOverrideManifestDriver;

  beforeEach(() => {
    driver = new ResolveOverrideManifestDriver();
  });

  describe('when the runtime selects a host', () => {
    const runtime = aHostRuntimeConfig();

    beforeEach(() => {
      driver.given.runtime(runtime);
    });

    it('should return the manifest untouched when it is on the local channel', async () => {
      const manifest = anAppManifest({ channel: 'local' });
      await driver.when.resolved(manifest);

      expect(driver.get.result()).toBe(manifest);
    });

    it('should return the manifest untouched when its remote entry carries no registry marker', async () => {
      const manifest = anAppManifest({
        channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
      });
      await driver.when.resolved(manifest);

      expect(driver.get.fetchJsonMock()).not.toHaveBeenCalled();
    });

    describe('when a published app lives under a registry', () => {
      const registryRoot = aRegistryUrl();
      const appId = faker.string.uuid();
      const manifest = anAppManifest({
        id: appId,
        channel: 'production',
        remoteEntryUrl: `${registryRoot}/apps/${appId}/${faker.system.semver()}/remoteEntry.json`,
      });
      const descriptor = aManifestDescriptor();

      it('should fetch the registry index from the registry root when resolved', async () => {
        driver.given.registry(aStaticRegistry());
        await driver.when.resolved(manifest);

        expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
          url: `${registryRoot}/registry.json`,
          runtime,
        });
      });

      it('should keep the stored manifest when the registry does not list the app', async () => {
        driver.given.registry(aStaticRegistry());
        await driver.when.resolved(manifest);

        expect(driver.get.result()).toBe(manifest);
      });

      it('should keep the stored manifest when the registry cannot be fetched', async () => {
        driver.given.registryFailure(new Error(faker.lorem.sentence()));
        await driver.when.resolved(manifest);

        expect(driver.get.result()).toBe(manifest);
      });

      describe('when the registry lists the stored release', () => {
        beforeEach(() => {
          driver.given.registry(
            aStaticRegistry({
              apps: {
                [manifest.id]: {
                  id: manifest.id,
                  name: manifest.name,
                  releases: { [manifest.version]: descriptor },
                  previews: {},
                },
              },
            }),
          );
        });

        it('should load the published artifact from the registry root when resolved', async () => {
          driver.given.publishedArtifact(anAppManifest({ id: manifest.id }));
          await driver.when.resolved(manifest);

          expect(driver.get.loadPublishedArtifactMock()).toHaveBeenCalledWith({
            reference: {
              ...descriptor,
              url: `${registryRoot}/${descriptor.path}`,
            },
            runtime,
          });
        });

        it('should return the published manifest when its kind matches', async () => {
          const published = anAppManifest({ id: manifest.id });
          driver.given.publishedArtifact(published);
          await driver.when.resolved(manifest);

          expect(driver.get.result()).toBe(published);
        });

        it('should keep the stored manifest when the published kind differs', async () => {
          driver.given.publishedArtifact(aHostManifest({ id: manifest.id }));
          await driver.when.resolved(manifest);

          expect(driver.get.result()).toBe(manifest);
        });

        it('should reject when the published artifact fails to load', async () => {
          const failure = new Error(faker.lorem.sentence());
          driver.given.publishedArtifactFailure(failure);
          await driver.when.resolved(manifest);

          expect(driver.get.error()).toBe(failure);
        });
      });

      it('should load the preview artifact when the stored manifest names a PR', async () => {
        const prNumber = faker.number.int({ min: 1, max: 9999 });
        const preview = { ...manifest, channel: 'pr' as const, prNumber };
        const previewDescriptor = aManifestDescriptor();
        driver.given
          .registry(
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
        await driver.when.resolved(preview);

        expect(driver.get.loadPublishedArtifactMock()).toHaveBeenCalledWith({
          reference: {
            ...previewDescriptor,
            url: `${registryRoot}/${previewDescriptor.path}`,
          },
          runtime,
        });
      });
    });

    it('should look the host up under the hosts collection when the manifest is a host', async () => {
      const registryRoot = aRegistryUrl();
      const hostId = faker.string.uuid();
      const manifest = aHostManifest({
        id: hostId,
        channel: 'production',
        remoteEntryUrl: `${registryRoot}/hosts/${hostId}/${faker.system.semver()}/remoteEntry.json`,
      });
      const descriptor = aManifestDescriptor();
      driver.given
        .registry(
          aStaticRegistry({
            hosts: {
              [hostId]: {
                id: hostId,
                name: manifest.name,
                releases: { [manifest.version]: descriptor },
                previews: {},
              },
            },
          }),
        )
        .given.publishedArtifact(aHostManifest({ id: hostId }));
      await driver.when.resolved(manifest);

      expect(driver.get.loadPublishedArtifactMock()).toHaveBeenCalledWith({
        reference: { ...descriptor, url: `${registryRoot}/${descriptor.path}` },
        runtime,
      });
    });
  });
});
