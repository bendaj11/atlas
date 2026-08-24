import type { AtlasStaticRegistry } from '@atlas/schema';
import { createHostDiscovery } from './host-discovery.js';

describe('host discovery projection', () => {
  it('should include environments deployed to different servers when URLs are bound', () => {
    const registry = registryWithBindings();

    const discovery = createHostDiscovery(
      registry,
      'customer-host',
      'https://registry.example.com',
    );

    expect(discovery.bindings).toStrictEqual([
      {
        baseUrl: 'https://production.example.com',
        environment: 'production',
        manifestUrl:
          'https://registry.example.com/environments/production/hosts/customer-host/manifest.json',
      },
      {
        baseUrl: 'https://staging.other.example.com/portal',
        environment: 'staging',
        manifestUrl:
          'https://registry.example.com/environments/staging/hosts/customer-host/manifest.json',
      },
    ]);
  });
});

function registryWithBindings(): AtlasStaticRegistry {
  return {
    schemaVersion: '2',
    revision: `sha256:${'0'.repeat(64)}`,
    updatedAt: '2026-08-24T00:00:00.000Z',
    apps: {},
    hosts: {},
    deployments: {
      staging: {
        apps: {},
        hosts: {
          'customer-host': {
            version: '1.0.0',
            baseUrls: ['https://staging.other.example.com/portal'],
          },
        },
        expectedHostRevisions: {},
      },
      production: {
        apps: {},
        hosts: {
          'customer-host': {
            version: '1.0.0',
            baseUrls: ['https://production.example.com'],
          },
        },
        expectedHostRevisions: {},
      },
    },
  };
}
