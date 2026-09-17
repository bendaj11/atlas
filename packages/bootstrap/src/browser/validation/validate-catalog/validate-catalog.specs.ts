import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
} from '@atlas/testkit';
import { aPublishedHostManifestFor } from '../../../testkit/host-manifests.testkit.js';
import { ValidateCatalogDriver } from './validate-catalog.driver.js';

describe('validateCatalog', () => {
  let driver: ValidateCatalogDriver;

  beforeEach(() => {
    driver = new ValidateCatalogDriver();
  });

  describe('when the runtime selects a host', () => {
    const runtime = aHostRuntimeConfig();

    beforeEach(() => {
      driver.given.runtime(runtime);
    });

    it('should accept a catalog whose host matches the runtime when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      driver.given.catalog(aHostCatalog({ host })).when.catalogValidated();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject a catalog with an unsupported schema version when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      driver.given
        .catalog({ ...aHostCatalog({ host }), schemaVersion: '2' as '1' })
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: 'Atlas catalog schemaVersion must be "1", got "2".',
      });
    });

    it('should reject a catalog for another host when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      const hostId = faker.string.uuid();
      driver.given
        .catalog(aHostCatalog({ host, hostId }))
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas catalog belongs to host "${hostId}" but runtime selects host "${runtime.hostId}".`,
      });
    });

    it('should reject a catalog whose host entry has another id when validated', () => {
      const host = aPublishedHostManifestFor(runtime, {
        id: faker.string.uuid(),
      });
      driver.given
        .catalog(aHostCatalog({ host, hostId: runtime.hostId }))
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas catalog host entry must be a host manifest with id "${runtime.hostId}", got host manifest "${host.id}".`,
      });
    });

    it('should reject a catalog whose apps are not an array when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      driver.given
        .catalog({ ...aHostCatalog({ host }), apps: {} as never })
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: 'Atlas catalog apps must be an array.',
      });
    });

    it('should reject a catalog whose widget providers are not an array when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      driver.given
        .catalog({ ...aHostCatalog({ host }), widgetProviders: {} as never })
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: 'Atlas catalog widget providers must be an array.',
      });
    });

    it('should reject a catalog whose apps contain a host manifest when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      const stray = aHostManifest();
      driver.given
        .catalog(aHostCatalog({ host, apps: [stray as never] }))
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas catalog apps must contain app manifests only, got host manifest "${stray.id}".`,
      });
    });

    it('should reject a catalog whose widget providers contain a host manifest when validated', () => {
      const host = aPublishedHostManifestFor(runtime);
      const stray = aHostManifest();
      driver.given
        .catalog(aHostCatalog({ host, widgetProviders: [stray as never] }))
        .when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas catalog widget providers must contain app manifests only, got host manifest "${stray.id}".`,
      });
    });

    it('should reject a catalog whose host manifest fails host validation when validated', () => {
      const host = aPublishedHostManifestFor(runtime, {
        requiredLoaderApiVersion: '^2.0.0',
      });
      driver.given.catalog(aHostCatalog({ host })).when.catalogValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MANIFEST_INVALID',
      });
    });
  });
});
