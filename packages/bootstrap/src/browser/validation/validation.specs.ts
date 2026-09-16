import { faker } from '@faker-js/faker';
import {
  PUBLISHED_CHANNELS,
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  aRegistryUrl,
  anAppManifest,
} from '@atlas/testkit';
import { aPublishedHostManifestFor } from '../../testkit/host-manifests.testkit.js';
import { ValidationDriver } from './validation.driver.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

describe('validateCatalog', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
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

describe('validateHostManifest', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
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

describe('validateArtifactUrl', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
  });

  describe('when the manifest is on the local channel', () => {
    const runtime = aHostRuntimeConfig();
    const manifest = anAppManifest({ channel: 'local' });

    beforeEach(() => {
      driver.given.runtime(runtime).given.manifest(manifest);
    });

    it.each(LOOPBACK_HOSTS)(
      'should accept an http URL on %s when validated',
      (host) => {
        driver.given
          .url(new URL(`http://${host}:4200/remote-entry.json`))
          .when.artifactUrlValidated();

        expect(driver.get.error()).toBeUndefined();
      },
    );

    it('should reject a non-http URL when validated', () => {
      driver.given
        .url(new URL('ws://localhost:4200/remote-entry.json'))
        .when.artifactUrlValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_URL_REJECTED',
        summary: `Local app manifest "${manifest.id}" URL "ws://localhost:4200/remote-entry.json" must use HTTP(S).`,
      });
    });

    it('should reject a non-loopback URL when validated', () => {
      const url = new URL(faker.internet.url());
      driver.given.url(url).when.artifactUrlValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_URL_REJECTED',
        summary: `Local app manifest "${manifest.id}" URL "${url.href}" must use a loopback hostname.`,
      });
    });
  });

  describe('when the manifest is on a published channel', () => {
    const manifest = anAppManifest({
      channel: faker.helpers.arrayElement(PUBLISHED_CHANNELS),
    });

    beforeEach(() => {
      driver.given.manifest(manifest);
    });

    it('should accept an https URL on the artifact registry origin when validated', () => {
      const runtime = aHostRuntimeConfig();
      driver.given
        .runtime(runtime)
        .given.url(
          new URL(`${runtime.artifactRegistryUrl}/${faker.system.fileName()}`),
        )
        .when.artifactUrlValidated();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should accept an http loopback URL when the artifact registry is loopback', () => {
      driver.given
        .runtime(
          aHostRuntimeConfig({ artifactRegistryUrl: 'http://localhost:4400' }),
        )
        .given.url(new URL('http://127.0.0.1:4200/remote-entry.json'))
        .when.artifactUrlValidated();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject an http URL when the artifact registry is not loopback', () => {
      const runtime = aHostRuntimeConfig();
      driver.given
        .runtime(runtime)
        .given.url(new URL('http://localhost:4200/remote-entry.json'))
        .when.artifactUrlValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_URL_REJECTED',
        summary: `Published app manifest "${manifest.id}" URL "http://localhost:4200/remote-entry.json" must use HTTPS.`,
      });
    });

    it('should reject an https URL on another origin when validated', () => {
      const runtime = aHostRuntimeConfig();
      const url = new URL(`${aRegistryUrl()}/${faker.system.fileName()}`);
      driver.given.runtime(runtime).given.url(url).when.artifactUrlValidated();

      expect(driver.get.error()).toMatchObject({
        code: 'ARTIFACT_URL_REJECTED',
        summary: `Published app manifest "${manifest.id}" URL "${url.href}" uses origin "${url.origin}" outside artifactRegistryUrl origin "${new URL(runtime.artifactRegistryUrl).origin}".`,
      });
    });
  });
});
