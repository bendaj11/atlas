import { faker } from '@faker-js/faker';
import {
  aHostRuntimeConfig,
  aManifestDescriptor,
  anAppManifest,
} from '@atlas/testkit';
import { PublishedArtifactDriver } from './published-artifact.driver.js';

describe('loadPublishedArtifact', () => {
  let driver: PublishedArtifactDriver;

  beforeEach(() => {
    driver = new PublishedArtifactDriver();
  });

  describe('when the runtime selects an artifact registry', () => {
    const runtime = aHostRuntimeConfig();
    const reference = aManifestDescriptor();
    const body = JSON.stringify({ name: faker.company.name() });
    const bytes = new TextEncoder().encode(body);

    beforeEach(() => {
      driver.given
        .runtime(runtime)
        .given.reference(reference)
        .given.fetchedBytes(bytes)
        .given.hydratedManifest(anAppManifest());
    });

    it('should fetch the artifact under the artifact registry when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.fetchBytesMock()).toHaveBeenCalledWith({
        url: `${runtime.artifactRegistryUrl}/${reference.path}`,
        runtime,
      });
    });

    it('should verify the fetched bytes against the reference when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.assertBytesMatchDescriptorMock()).toHaveBeenCalledWith(
        bytes,
        reference,
      );
    });

    it('should hydrate the decoded manifest with its URL when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.hydrateMock()).toHaveBeenCalledWith(
        JSON.parse(body),
        `${runtime.artifactRegistryUrl}/${reference.path}`,
      );
    });

    it('should return the hydrated manifest when loaded', async () => {
      const manifest = anAppManifest();
      driver.given.hydratedManifest(manifest);
      await driver.when.loaded();

      expect(driver.get.result()).toBe(manifest);
    });

    it('should reject with the verification failure when the bytes do not match the reference', async () => {
      const failure = new Error(faker.lorem.sentence());
      driver.given.descriptorFailure(failure);
      await driver.when.loaded();

      expect(driver.get.error()).toBe(failure);
    });

    it('should not hydrate when the bytes do not match the reference', async () => {
      driver.given.descriptorFailure(new Error(faker.lorem.sentence()));
      await driver.when.loaded();

      expect(driver.get.hydrateMock()).not.toHaveBeenCalled();
    });
  });
});
