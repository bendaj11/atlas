import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { ManifestIntegrityDriver } from './manifest-integrity.driver.js';

const HELLO_INTEGRITY = 'sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=';

describe('verifyManifestIntegrity', () => {
  let driver: ManifestIntegrityDriver;

  beforeEach(() => {
    driver = new ManifestIntegrityDriver();
  });

  describe('when a production manifest declares a sha256 integrity', () => {
    const manifest = anAppManifest({
      channel: 'production',
      integrity: HELLO_INTEGRITY,
    });

    it('should accept the manifest when the remote entry bytes match', async () => {
      await driver.given.remoteBytes('hello').when.verified([manifest]);

      expect(driver.get.error()).toBeUndefined();
    });

    it('should fetch the remote entry url when verified', async () => {
      await driver.given.remoteBytes('hello').when.verified([manifest]);

      expect(driver.get.fetchBytesMock()).toHaveBeenCalledWith(
        manifest.remoteEntryUrl,
      );
    });

    it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the remote entry bytes differ', async () => {
      await driver.given.remoteBytes('changed').when.verified([manifest]);

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_REMOTE_TRUST_REJECTED',
        message: expect.stringContaining('remote entry bytes do not match'),
      });
    });
  });

  it('should not fetch the remote entry when a production manifest has no integrity', async () => {
    await driver.when.verified([anAppManifest({ channel: 'production' })]);

    expect(driver.get.fetchBytesMock()).not.toHaveBeenCalled();
  });

  it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the integrity algorithm is not sha256', async () => {
    await driver.when.verified([
      anAppManifest({ channel: 'production', integrity: 'sha384-abc' }),
    ]);

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_REMOTE_TRUST_REJECTED',
      message: expect.stringContaining('unsupported integrity value'),
    });
  });

  it('should reject before fetching when the remote entry protocol is unsupported', async () => {
    await driver.when.verified([
      anAppManifest({
        channel: 'production',
        remoteEntryUrl: 'ftp://assets.example.com/remoteEntry.json',
        integrity: HELLO_INTEGRITY,
      }),
    ]);

    expect(driver.get.fetchBytesMock()).not.toHaveBeenCalled();
  });

  it('should accept a local loopback manifest when its integrity bytes match', async () => {
    await driver.given.remoteBytes('hello').when.verified([
      anAppManifest({
        channel: 'local',
        remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
        integrity: HELLO_INTEGRITY,
      }),
    ]);

    expect(driver.get.error()).toBeUndefined();
  });
});

describe('findManifestTrustErrors', () => {
  let driver: ManifestIntegrityDriver;

  beforeEach(() => {
    driver = new ManifestIntegrityDriver();
  });

  it('should report only the rejected manifest when one of two manifests fails verification', async () => {
    const trusted = anAppManifest({ channel: 'production' });
    const rejected = anAppManifest({
      channel: 'production',
      remoteEntryUrl: `ftp://${faker.internet.domainName()}/remoteEntry.json`,
    });
    await driver.when.trustErrorsCollected([trusted, rejected]);

    expect([...driver.get.trustErrors().keys()]).toEqual([rejected.id]);
  });

  it('should report the fetch failure when the remote entry cannot be downloaded', async () => {
    const manifest = anAppManifest({
      channel: 'production',
      integrity: HELLO_INTEGRITY,
    });
    await driver.given
      .remoteBytesFailing(new Error('offline'))
      .when.trustErrorsCollected([manifest]);

    expect(driver.get.trustErrors().get(manifest.id)?.message).toMatch(
      'offline',
    );
  });
});
