import { beforeEach, describe, expect, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { ValidationDriver } from './validation.driver.js';

describe('validateHostManifest', () => {
  let driver: ValidationDriver;

  beforeEach(() => {
    driver = new ValidationDriver();
  });

  it('should accept approved host artifact when loader API version is compatible', () => {
    driver.given
      .approvedHostArtifact(new URL(faker.internet.url()))
      .when.validateHost();

    expect(driver.get.error()).toBeUndefined();
  });

  it('should reject host artifact when origin is outside artifact registry', () => {
    driver.given
      .unapprovedHostArtifact(new URL(faker.internet.url()))
      .when.validateArtifact();

    expect(driver.get.error()).toEqual(
      new Error(
        'Selected host URL uses an origin outside artifactRegistryUrl.',
      ),
    );
  });

  it('should reject host manifest when loader API version is incompatible', () => {
    driver.given.incompatibleLoaderApi('^2.0.0').when.validateHost();

    expect(driver.get.error()).toEqual(
      new Error(
        'Selected host client requires an incompatible Atlas loader API.',
      ),
    );
  });

  it('should accept loopback HTTP artifact when local channel is selected', () => {
    driver.given
      .localLoopbackArtifact(new URL('http://localhost:4200/remote-entry.json'))
      .when.validateArtifact();

    expect(driver.get.error()).toBeUndefined();
  });

  it('should reject non-loopback artifact when local channel is selected', () => {
    driver.given
      .localRemoteArtifact(new URL(faker.internet.url()))
      .when.validateArtifact();

    expect(driver.get.error()).toEqual(
      new Error('Local host URL must use loopback.'),
    );
  });
});
