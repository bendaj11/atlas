import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, anAppManifest } from '@atlas/testkit';
import { PUBLISHED_CHANNELS, aRegistryUrl } from '@atlas/testkit/internal';
import { ValidateArtifactUrlDriver } from './validate-artifact-url.driver.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

describe('validateArtifactUrl', () => {
  let driver: ValidateArtifactUrlDriver;

  beforeEach(() => {
    driver = new ValidateArtifactUrlDriver();
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
