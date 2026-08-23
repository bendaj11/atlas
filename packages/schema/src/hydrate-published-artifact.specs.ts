import { describe, expect, it } from '@jest/globals';
import type { AtlasAppArtifactManifest } from './atlas-publication.js';
import { hydratePublishedArtifactManifest } from './hydrate-published-artifact.js';

const APP_ID = '5ab68dd4-f18c-4811-8768-b636ce559df6';
const DIGEST = `sha256:${'a'.repeat(64)}` as const;
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

describe('hydratePublishedArtifactManifest', () => {
  it('should preserve canonical app behavior when manifest is hydrated', () => {
    const hydrated = hydratePublishedArtifactManifest(
      appManifest(),
      'https://registry.example/apps/orders/1.4.0/manifest.json',
    );

    expect(hydrated).toMatchObject({
      kind: 'app',
      id: APP_ID,
      version: '1.4.0',
      remoteEntryUrl:
        'https://registry.example/apps/orders/1.4.0/remoteEntry.js',
      isolation: 'shadow-dom',
      metadata: { domain: 'commerce' },
      exportedWidgets: [
        {
          name: 'Order summary',
          remoteEntryUrl:
            'https://registry.example/apps/orders/1.4.0/remoteEntry.js',
        },
      ],
    });
  });

  it('should reject malformed data when manifest is hydrated', () => {
    expect(() =>
      hydratePublishedArtifactManifest(
        {},
        'https://registry.example/manifest.json',
      ),
    ).toThrow('requires schemaVersion "2"');
  });
});

function appManifest(): AtlasAppArtifactManifest {
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: APP_ID,
    name: 'orders',
    release: { version: '1.4.0' },
    framework: 'react',
    entryPath: 'remoteEntry.js',
    exposes: { entry: './entry' },
    isolation: 'shadow-dom',
    requiredHostSdkVersion: '^0.1.0',
    supportedHosts: ['*'],
    placements: [],
    metadata: { domain: 'commerce' },
    exportedWidgets: [
      {
        schemaVersion: '1',
        id: '7cb68dd4-f18c-4811-8768-b636ce559df6',
        name: 'Order summary',
        ownerAppId: APP_ID,
        framework: 'react',
        expose: './widgets/order-summary',
        contractVersion: '1',
      },
    ],
    files: [
      {
        path: 'remoteEntry.js',
        digest: DIGEST,
        size: 100,
        mediaType: 'text/javascript; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        role: 'remote-entry',
      },
    ],
  };
}
