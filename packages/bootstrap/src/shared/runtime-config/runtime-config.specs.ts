import { beforeEach, describe, expect, it } from '@jest/globals';
import { RuntimeConfigDriver } from './runtime-config.driver.js';

describe('resolveAtlasRuntimeConfig', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should resolve a root-relative artifact registry when runtime config belongs to a host', () => {
    driver.when.resolve();

    expect(driver.get.runtime()).toEqual(
      expect.objectContaining({
        artifactRegistryUrl: 'https://host.example/atlas',
      }),
    );
  });

  it('should resolve a relative environment registry when runtime config belongs to a host', () => {
    driver.given.environmentRegistryUrl('./environments/').when.resolve();

    expect(driver.get.runtime()).toEqual(
      expect.objectContaining({
        environmentRegistryUrl: 'https://host.example/environments',
      }),
    );
  });

  it('should preserve an absolute artifact registry when runtime config belongs to a host', () => {
    driver.given
      .artifactRegistryUrl('https://registry.example/atlas')
      .when.resolve();

    expect(driver.get.runtime()).toEqual(
      expect.objectContaining({
        artifactRegistryUrl: 'https://registry.example/atlas',
      }),
    );
  });

  it('should preserve an absolute artifact registry when host URL is unavailable', () => {
    driver.given
      .hostUrl(undefined)
      .given.artifactRegistryUrl('https://host.example/atlas')
      .when.resolve();

    expect(driver.get.runtime()).toEqual(
      expect.objectContaining({
        artifactRegistryUrl: 'https://host.example/atlas',
      }),
    );
  });

  it('should reject an insecure absolute artifact registry when runtime config belongs to a host', () => {
    driver.given
      .artifactRegistryUrl('http://registry.example/atlas')
      .when.resolve();

    expect(driver.get.error()).toEqual(
      new Error(
        'Atlas runtime artifactRegistryUrl requires HTTPS outside local development.',
      ),
    );
  });
});
