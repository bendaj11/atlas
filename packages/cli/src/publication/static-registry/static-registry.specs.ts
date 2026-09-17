import { faker } from '@faker-js/faker';
import { aManifestDescriptor, anAppArtifactManifest } from '@atlas/testkit';
import { StaticRegistryDriver } from './static-registry.driver.js';

describe('static registry', () => {
  let driver: StaticRegistryDriver;

  beforeEach(() => {
    driver = new StaticRegistryDriver();
  });

  it('should omit environment deployments when empty registry is created', () => {
    driver.when.emptyRegistryCreated();

    expect(driver.get.registry()).not.toHaveProperty('deployments');
  });

  it('should store descriptor when immutable release is published', () => {
    const version = faker.system.semver();
    const manifest = anAppArtifactManifest({ release: { version } });
    const descriptor = aManifestDescriptor();

    driver.when.published({ manifest, descriptor });

    expect(driver.get.appRelease({ manifest, version })).toStrictEqual(
      descriptor,
    );
  });
});
