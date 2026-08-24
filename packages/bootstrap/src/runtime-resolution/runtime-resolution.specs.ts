import { describe, expect, it } from '@jest/globals';
import type { AtlasHostDiscovery } from '@atlas/schema';
import {
  atlasDiscoveryRequest,
  resolveAtlasHostRuntime,
} from './runtime-resolution.js';

const bootstrap = {
  schemaVersion: '2',
  hostId: 'customer-host',
  registryUrl: 'https://registry.example/atlas',
  resourcesTimeoutMs: 15000,
  resourcesRetryCount: 3,
} as const;

const discovery: AtlasHostDiscovery = {
  schemaVersion: '1',
  hostId: 'customer-host',
  bindings: [
    {
      baseUrl: 'https://customer.example/portal',
      environment: 'production',
      manifestUrl:
        'https://registry.example/atlas/environments/production/hosts/customer-host/manifest.json',
    },
  ],
};

describe('Atlas runtime resolution', () => {
  it('should describe discovery request when bootstrap is static', () => {
    expect(atlasDiscoveryRequest(bootstrap)).toStrictEqual({
      url: 'https://registry.example/atlas/hosts/customer-host/discovery.json',
      runtime: {
        schemaVersion: '1',
        hostId: 'customer-host',
        environment: 'discovery',
        manifestUrl:
          'https://registry.example/atlas/hosts/customer-host/discovery.json',
        registryUrl: 'https://registry.example/atlas',
        resourcesTimeoutMs: 15000,
        resourcesRetryCount: 3,
      },
    });
  });

  it('should select runtime when page matches discovery binding', () => {
    expect(
      resolveAtlasHostRuntime(
        bootstrap,
        discovery,
        'https://customer.example/portal/orders',
      ),
    ).toStrictEqual({
      schemaVersion: '1',
      hostId: 'customer-host',
      environment: 'production',
      manifestUrl:
        'https://registry.example/atlas/environments/production/hosts/customer-host/manifest.json',
      registryUrl: 'https://registry.example/atlas',
      resourcesTimeoutMs: 15000,
      resourcesRetryCount: 3,
    });
  });
});
