import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, aRegistryRootUrl } from '../runtime.testkit.js';
import { RuntimeUrlsDriver } from './runtime-urls.driver.js';

describe('resolveEnvironmentRegistryUrl', () => {
  let driver: RuntimeUrlsDriver;

  beforeEach(() => {
    driver = new RuntimeUrlsDriver();
  });

  it('should return the artifact registry when the config has no environment registry', () => {
    const runtime = aHostRuntimeConfig();
    driver.given.runtime(runtime).when.environmentRegistryUrlBuilt();

    expect(driver.get.url()).toBe(runtime.artifactRegistryUrl);
  });

  it('should return the environment registry when the config has one', () => {
    const runtime = aHostRuntimeConfig({
      environmentRegistryUrl: aRegistryRootUrl(),
    });
    driver.given.runtime(runtime).when.environmentRegistryUrlBuilt();

    expect(driver.get.url()).toBe(runtime.environmentRegistryUrl);
  });
});

describe('buildEnvironmentManifestUrl', () => {
  let driver: RuntimeUrlsDriver;

  beforeEach(() => {
    driver = new RuntimeUrlsDriver();
  });

  it('should build the host manifest path under the environment registry when built', () => {
    const runtime = aHostRuntimeConfig({
      environmentRegistryUrl: aRegistryRootUrl(),
    });
    driver.given.runtime(runtime).when.environmentManifestUrlBuilt();

    expect(driver.get.url()).toBe(
      `${runtime.environmentRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
    );
  });
});

describe('buildArtifactUrl', () => {
  let driver: RuntimeUrlsDriver;

  beforeEach(() => {
    driver = new RuntimeUrlsDriver();
  });

  it('should join the path under the artifact registry when built', () => {
    const runtime = aHostRuntimeConfig();
    const path = `${faker.lorem.slug()}/manifest.json`;
    driver.given.runtime(runtime).when.artifactUrlBuilt(path);

    expect(driver.get.url()).toBe(`${runtime.artifactRegistryUrl}/${path}`);
  });
});
