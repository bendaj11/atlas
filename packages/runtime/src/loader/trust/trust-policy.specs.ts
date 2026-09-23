import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, anAppManifest, aStylesheet } from '@atlas/testkit';
import { TrustPolicyDriver } from './trust-policy.driver.js';

describe('createRemoteTrustPolicy', () => {
  let driver: TrustPolicyDriver;

  beforeEach(() => {
    driver = new TrustPolicyDriver();
  });

  it('should allow the artifact registry origin when no environment registry is configured', () => {
    const artifactRegistryUrl = faker.internet.url();
    driver.given.runtimeConfig(aHostRuntimeConfig({ artifactRegistryUrl }));

    expect(driver.get.allowedOrigins()).toEqual([
      new URL(artifactRegistryUrl).origin,
    ]);
  });

  it('should allow both registry origins when an environment registry is configured', () => {
    const artifactRegistryUrl = faker.internet.url();
    const environmentRegistryUrl = faker.internet.url();
    driver.given.runtimeConfig(
      aHostRuntimeConfig({ artifactRegistryUrl, environmentRegistryUrl }),
    );

    expect(driver.get.allowedOrigins()).toEqual([
      new URL(artifactRegistryUrl).origin,
      new URL(environmentRegistryUrl).origin,
    ]);
  });
});

describe('assertManifestAssetTrust', () => {
  let driver: TrustPolicyDriver;

  beforeEach(() => {
    driver = new TrustPolicyDriver();
  });

  describe('when the policy allows one origin', () => {
    const allowedOrigin = new URL(faker.internet.url()).origin;

    beforeEach(() => {
      driver.given.policy({ allowedOrigins: new Set([allowedOrigin]) });
    });

    it('should accept a production manifest when its remote entry and styles use the allowed origin', () => {
      driver.when.assetTrustAsserted(
        anAppManifest({
          channel: 'production',
          remoteEntryUrl: `${allowedOrigin}/remoteEntry.json`,
          styles: [aStylesheet({ href: `${allowedOrigin}/styles.css` })],
        }),
      );

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a production remote entry uses another origin', () => {
      driver.when.assetTrustAsserted(
        anAppManifest({
          channel: 'production',
          remoteEntryUrl: faker.internet.url(),
        }),
      );

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_REMOTE_TRUST_REJECTED',
        message: expect.stringContaining('uses remote origin'),
      });
    });

    it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a production stylesheet uses another origin', () => {
      driver.when.assetTrustAsserted(
        anAppManifest({
          channel: 'production',
          remoteEntryUrl: `${allowedOrigin}/remoteEntry.json`,
          styles: [aStylesheet({ href: faker.internet.url() })],
        }),
      );

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_REMOTE_TRUST_REJECTED',
        message: expect.stringContaining('uses stylesheet origin'),
      });
    });

    it('should accept a local manifest on loopback when its origin is not allowed', () => {
      driver.when.assetTrustAsserted(
        anAppManifest({
          channel: 'local',
          remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
        }),
      );

      expect(driver.get.error()).toBeUndefined();
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a production remote entry uses a non-http protocol', () => {
    driver.when.assetTrustAsserted(
      anAppManifest({
        channel: 'production',
        remoteEntryUrl: 'ftp://cdn.example/remoteEntry.json',
      }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      message: expect.stringContaining('unsupported remote protocol "ftp:"'),
    });
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a local manifest uses a non-loopback remote entry', () => {
    driver.when.assetTrustAsserted(
      anAppManifest({
        channel: 'local',
        remoteEntryUrl: 'http://192.168.1.20/remoteEntry.json',
      }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      message: expect.stringContaining('uses non-loopback asset URL'),
    });
  });
});

describe('assertManifestStylesTrust', () => {
  let driver: TrustPolicyDriver;

  beforeEach(() => {
    driver = new TrustPolicyDriver();
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when a production stylesheet uses a non-http protocol', () => {
    driver.when.stylesTrustAsserted(
      anAppManifest({
        channel: 'production',
        styles: [aStylesheet({ href: 'data:text/css,body{}' })],
      }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      message: expect.stringContaining(
        'unsupported stylesheet protocol "data:"',
      ),
    });
  });

  it('should ignore the remote entry when only styles are asserted', () => {
    driver.when.stylesTrustAsserted(
      anAppManifest({
        channel: 'production',
        remoteEntryUrl: 'ftp://cdn.example/x',
      }),
    );

    expect(driver.get.error()).toBeUndefined();
  });
});
