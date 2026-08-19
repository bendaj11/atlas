import { beforeEach, describe, expect, it } from '@jest/globals';
import { RuntimeConfigDriver } from './runtime-config.driver.js';

describe('createHostRuntimeConfig', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should create runtime config when host settings and CLI URLs are valid', () => {
    driver.given.hostConfig({
      resourcesRetryCount: 2,
      resourcesTimeoutMs: 1000,
    });
    driver.given.hostVersion('1.2.3');
    driver.given.arguments([
      '--registry-base-url',
      'https://registry.example.com/',
      '--asset-origins',
      'https://assets.example.com/path',
      '--external-registry-urls',
      'https://external.example.com/catalog/',
    ]);
    driver.when.create();

    expect(driver.get.runtime()).toEqual({
      assetOrigins: ['https://assets.example.com'],
      catalogUrl: `https://registry.example.com/hosts/${driver.get.hostId()}/catalog.json`,
      externalRegistryUrls: ['https://external.example.com/catalog'],
      hostId: driver.get.hostId(),
      hostVersion: '1.2.3',
      registryUrl: 'https://registry.example.com',
      resourcesRetryCount: 2,
      resourcesTimeoutMs: 1000,
      schemaVersion: '1',
    });
  });

  it('should reject insecure asset origin when CLI URL is not loopback', () => {
    driver.given.arguments(['--asset-origins', 'http://assets.example.com']);
    driver.when.create();

    expect(driver.get.error()).toThrow(
      '--asset-origins must contain HTTPS URLs or loopback URLs for local development.',
    );
  });

  it('should reject app config when bootstrap runtime config is requested', () => {
    driver.given.hostConfig({ type: 'app', routes: [] });
    driver.when.create();

    expect(driver.get.error()).toThrow(
      'Atlas bootstrap build expects a host config',
    );
  });
});
