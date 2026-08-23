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
      '--registry-url',
      'https://registry.example.com/',
      '--environment',
      'production',
      '--asset-origins',
      'https://assets.example.com/path',
      '--external-registries',
      'https://external.example.com/catalog|production',
    ]);
    driver.when.create();

    expect(driver.get.runtime()).toEqual({
      assetOrigins: ['https://assets.example.com'],
      externalRegistries: [
        {
          environment: 'production',
          registryUrl: 'https://external.example.com/catalog',
        },
      ],
      hostId: driver.get.hostId(),
      hostVersion: '1.2.3',
      manifestUrl: `https://registry.example.com/environments/production/hosts/${driver.get.hostId()}/manifest.json`,
      environment: 'production',
      registryUrl: 'https://registry.example.com',
      resourcesRetryCount: 2,
      resourcesTimeoutMs: 1000,
      schemaVersion: '1',
    });
  });

  it('should reject missing environment when registry is not local', () => {
    driver.given.arguments(['--registry-url', 'https://registry.example.com']);
    driver.when.create();

    expect(driver.get.error()).toThrow(
      '--environment or ATLAS_ENVIRONMENT is required',
    );
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
