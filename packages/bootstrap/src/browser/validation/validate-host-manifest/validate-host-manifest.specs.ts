import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { aPublishedHostManifestFor } from '../../../testkit/host-manifests.testkit.js';
import { ValidateHostManifestDriver } from './validate-host-manifest.driver.js';

describe('validateHostManifest', () => {
  let driver: ValidateHostManifestDriver;

  beforeEach(() => {
    driver = new ValidateHostManifestDriver();
  });

  describe('when the runtime selects a host', () => {
    const runtime = aHostRuntimeConfig();

    beforeEach(() => {
      driver.given.runtime(runtime);
    });

    it('should accept a host manifest from the artifact registry when validated', () => {
      driver.given
        .manifest(aPublishedHostManifestFor(runtime))
        .when.hostManifestValidated();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject a host manifest with another id when validated', () => {
      const manifest = aPublishedHostManifestFor(runtime, {
        id: faker.string.uuid(),
      });
      driver.given.manifest(manifest).when.hostManifestValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MANIFEST_INVALID',
        summary: `Selected host manifest must be a host manifest with id "${runtime.hostId}", got host manifest "${manifest.id}".`,
      });
    });

    it('should reject a host manifest without an entry expose when validated', () => {
      driver.given
        .manifest(aPublishedHostManifestFor(runtime, { exposes: {} as never }))
        .when.hostManifestValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MANIFEST_INVALID',
        summary: `Selected host manifest "${runtime.hostId}" has no entry expose.`,
      });
    });

    it('should reject a host manifest requiring another loader API major when validated', () => {
      driver.given
        .manifest(
          aPublishedHostManifestFor(runtime, {
            requiredLoaderApiVersion: '^2.0.0',
          }),
        )
        .when.hostManifestValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MANIFEST_INVALID',
        summary: `Selected host manifest "${runtime.hostId}" requires Atlas loader API ^2.0.0 but this loader provides 1.0.0.`,
      });
    });

    it('should reject a host manifest whose remote entry is outside the artifact registry when validated', () => {
      driver.given
        .manifest(
          aPublishedHostManifestFor(runtime, {
            remoteEntryUrl: faker.internet.url(),
          }),
        )
        .when.hostManifestValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_URL_REJECTED',
      });
    });
  });
});
