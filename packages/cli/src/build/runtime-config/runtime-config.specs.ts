import { beforeEach, describe, expect, it } from '@jest/globals';
import { RuntimeConfigDriver } from './runtime-config.driver.js';

describe('createHostRuntimeConfig', () => {
  let driver: RuntimeConfigDriver;

  beforeEach(() => {
    driver = new RuntimeConfigDriver();
  });

  it('should create runtime config when host settings and CLI URLs are valid', () => {
    driver.given.arguments([
      '--registry-url',
      'https://registry.example.com/',
      '--environment',
      'production',
      '--environment-registry-url',
      'https://production.example.com/atlas/',
    ]);
    driver.when.create();

    expect(driver.get.runtime()).toEqual({
      hostId: driver.get.hostId(),
      environment: 'production',
      artifactRegistryUrl: 'https://registry.example.com',
      environmentRegistryUrl: 'https://production.example.com/atlas',
      schemaVersion: 'v1',
    });
  });

  it('should reject missing environment when registry is not local', () => {
    driver.given.arguments(['--registry-url', 'https://registry.example.com']);
    driver.when.create();

    expect(driver.get.error()).toThrow(
      '--environment or ATLAS_ENVIRONMENT is required',
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
