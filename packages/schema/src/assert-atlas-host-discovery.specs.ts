import {
  assertAtlasHostDiscovery,
  normalizeAtlasHostBaseUrl,
} from './assert-atlas-host-discovery.js';

describe('host discovery validation', () => {
  it('should accept bindings on different servers when document is valid', () => {
    const discovery = {
      schemaVersion: '1',
      hostId: 'customer-host',
      bindings: [
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
            'https://other-registry.example.com/environments/staging/hosts/customer-host/manifest.json',
        },
      ],
    };

    expect(() => assertAtlasHostDiscovery(discovery)).not.toThrow();
  });

  it('should reject duplicate normalized base URLs when bindings overlap', () => {
    const discovery = {
      schemaVersion: '1',
      hostId: 'customer-host',
      bindings: [
        {
          baseUrl: 'https://production.example.com/portal/',
          environment: 'production',
          manifestUrl:
            'https://registry.example.com/environments/production/hosts/customer-host/manifest.json',
        },
        {
          baseUrl: 'https://production.example.com/portal',
          environment: 'staging',
          manifestUrl:
            'https://registry.example.com/environments/staging/hosts/customer-host/manifest.json',
        },
      ],
    };

    expect(() => assertAtlasHostDiscovery(discovery)).toThrow(
      'Atlas host discovery repeats base URL "https://production.example.com/portal".',
    );
  });

  it('should reject insecure public URLs when binding uses HTTP', () => {
    expect(() => normalizeAtlasHostBaseUrl('http://example.com')).toThrow(
      'Atlas host base URL must use HTTPS outside loopback development.',
    );
  });

  it('should normalize trailing slashes when base URL contains a path', () => {
    expect(normalizeAtlasHostBaseUrl('https://example.com/customer///')).toBe(
      'https://example.com/customer',
    );
  });
});
