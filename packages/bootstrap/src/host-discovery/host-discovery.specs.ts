import { describe, expect, it } from '@jest/globals';
import type { AtlasHostDiscovery } from '@atlas/schema';
import { resolveHostDiscovery } from './host-discovery.js';

describe('resolveHostDiscovery', () => {
  it('should select longest matching path when bindings overlap', () => {
    const discovery: AtlasHostDiscovery = {
      schemaVersion: '1',
      hostId: 'host-id',
      bindings: [
        binding('https://example.com', 'production'),
        binding('https://example.com/admin', 'admin'),
      ],
    };

    expect(
      resolveHostDiscovery(
        discovery,
        'host-id',
        'https://example.com/admin/orders',
      ).environment,
    ).toBe('admin');
  });

  it('should reject unrelated origin when no binding matches', () => {
    const discovery: AtlasHostDiscovery = {
      schemaVersion: '1',
      hostId: 'host-id',
      bindings: [binding('https://example.com', 'production')],
    };

    expect(() =>
      resolveHostDiscovery(discovery, 'host-id', 'https://other.example.com/'),
    ).toThrow(/no deployment binding/);
  });

  it('should reject path prefix without segment boundary when resolving', () => {
    const discovery: AtlasHostDiscovery = {
      schemaVersion: '1',
      hostId: 'host-id',
      bindings: [binding('https://example.com/app', 'production')],
    };

    expect(() =>
      resolveHostDiscovery(
        discovery,
        'host-id',
        'https://example.com/application',
      ),
    ).toThrow(/no deployment binding/);
  });
});

function binding(baseUrl: string, environment: string) {
  return {
    baseUrl,
    environment,
    manifestUrl: `https://registry.example/environments/${environment}/hosts/host-id/manifest.json`,
  };
}
