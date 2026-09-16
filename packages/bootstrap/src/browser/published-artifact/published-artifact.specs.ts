import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import {
  aHostRuntimeConfig,
  aManifestDescriptor,
  aSha256Digest,
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
    const body = JSON.stringify({ name: faker.company.name() });
    const bytes = new TextEncoder().encode(body);
    const digest =
      `sha256:${createHash('sha256').update(body).digest('hex')}` as const;

    beforeEach(() => {
      driver.given.runtime(runtime).given.fetchedBytes(bytes);
    });

    describe('when the bytes match the descriptor', () => {
      const reference = aManifestDescriptor({ size: bytes.byteLength, digest });

      beforeEach(() => {
        driver.given.reference(reference);
      });

      it('should fetch the artifact under the artifact registry when loaded', async () => {
        driver.given.hydratedManifest(anAppManifest());
        await driver.when.loaded();

        expect(driver.get.fetchBytesMock()).toHaveBeenCalledWith({
          url: `${runtime.artifactRegistryUrl}/${reference.path}`,
          runtime,
        });
      });

      it('should hydrate the decoded manifest with its URL when loaded', async () => {
        driver.given.hydratedManifest(anAppManifest());
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
    });

    it('should reject when the byte length differs from the descriptor size', async () => {
      const reference = aManifestDescriptor({
        size: bytes.byteLength + 1,
        digest,
      });
      driver.given.reference(reference);
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Artifact manifest "${reference.path}" is ${bytes.byteLength} bytes but its descriptor records ${reference.size} bytes.`,
      });
    });

    it('should reject when the digest differs from the descriptor digest', async () => {
      const reference = aManifestDescriptor({
        size: bytes.byteLength,
        digest: aSha256Digest(),
      });
      driver.given.reference(reference);
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_VERIFICATION_FAILED',
        summary: `Artifact manifest "${reference.path}" digest ${digest} does not match its descriptor digest ${reference.digest}.`,
      });
    });
  });
});
