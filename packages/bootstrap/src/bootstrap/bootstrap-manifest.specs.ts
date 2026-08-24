import { describe, expect, it } from '@jest/globals';
import {
  assertAtlasBootstrapManifest,
  normalizeAtlasRegistryUrl,
} from './bootstrap-manifest.js';

describe('Atlas bootstrap manifest', () => {
  it('should accept stable registry when metadata is valid', () => {
    expect(() =>
      assertAtlasBootstrapManifest({
        schemaVersion: '2',
        hostId: 'customer-host',
        registryUrl: 'https://registry.example/atlas',
        resourcesTimeoutMs: 15000,
        resourcesRetryCount: 3,
      }),
    ).not.toThrow();
  });

  it('should reject insecure registry when URL is public', () => {
    expect(() =>
      normalizeAtlasRegistryUrl('http://registry.example/atlas'),
    ).toThrow(/HTTPS/);
  });

  it('should normalize trailing slash when registry has path prefix', () => {
    expect(normalizeAtlasRegistryUrl('https://registry.example/atlas/')).toBe(
      'https://registry.example/atlas',
    );
  });

  it('should reject bootstrap metadata when digest is malformed', () => {
    expect(() =>
      assertAtlasBootstrapManifest({
        schemaVersion: '2',
        hostId: 'customer-host',
        registryUrl: 'https://registry.example/atlas',
        resourcesTimeoutMs: 15000,
        resourcesRetryCount: 3,
        digest: 'not-a-digest',
      }),
    ).toThrow(/SHA-256/);
  });

  it('should reject bootstrap metadata when files escape the root', () => {
    expect(() =>
      assertAtlasBootstrapManifest({
        schemaVersion: '2',
        hostId: 'customer-host',
        registryUrl: 'https://registry.example/atlas',
        resourcesTimeoutMs: 15000,
        resourcesRetryCount: 3,
        files: ['../index.html'],
      }),
    ).toThrow(/root file names/);
  });

  it('should reject development runtime when environment is absent', () => {
    expect(() =>
      assertAtlasBootstrapManifest({
        schemaVersion: '2',
        hostId: 'customer-host',
        registryUrl: 'https://registry.example/atlas',
        resourcesTimeoutMs: 15000,
        resourcesRetryCount: 3,
        developmentRuntime: {
          schemaVersion: '1',
          hostId: 'customer-host',
          manifestUrl:
            'http://localhost:4400/environments/development/hosts/customer-host/manifest.json',
          developmentSessionUrl:
            'http://localhost:4400/atlas.dev-session.json?hostId=customer-host',
        },
      }),
    ).toThrow(/development runtime metadata is invalid/);
  });
});
