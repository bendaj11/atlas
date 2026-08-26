import { describe, expect, it } from '@jest/globals';
import {
  assertEnvironmentDeployment,
  assertPublishedArtifactManifest,
  assertReleaseVersion,
  assertSafeArtifactId,
  assertSafeRelativePath,
} from './publication-validation.js';

const DIGEST = `sha256:${'a'.repeat(64)}`;
const INTEGRITY = 'sha256-qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=';
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function appManifest(): Record<string, unknown> {
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id: '5ab68dd4-f18c-4811-8768-b636ce559df6',
    name: 'orders',
    release: { version: '1.4.0' },
    source: {
      gitSha: 'abc123',
      gitBranch: 'main',
      gitCommitTitle: 'Release orders',
    },
    framework: 'react',
    entryPath: 'remoteEntry.js',
    exposes: { entry: './entry' },
    isolation: 'shadow-dom',
    requiredHostSdkVersion: '^0.1.0',
    supportedHosts: ['d145969d-8fe8-4b71-8aa4-8fb71fe54f63'],
    placements: [
      {
        id: 'orders-route',
        kind: 'route',
        hostId: 'd145969d-8fe8-4b71-8aa4-8fb71fe54f63',
        route: {
          path: '/orders/:id',
          match: 'full',
          title: 'Orders',
          nav: { label: 'Orders', order: 1, visible: true },
        },
      },
      {
        id: 'orders-summary',
        kind: 'slot',
        hostId: 'd145969d-8fe8-4b71-8aa4-8fb71fe54f63',
        slot: 'dashboard',
      },
    ],
    exportedWidgets: [
      {
        schemaVersion: '1',
        id: '7cb68dd4-f18c-4811-8768-b636ce559df6',
        name: 'Order summary',
        ownerAppId: '5ab68dd4-f18c-4811-8768-b636ce559df6',
        framework: 'react',
        expose: './widgets/order-summary',
        contractVersion: '1',
        metadata: { category: 'commerce', priority: 1, stable: true },
      },
    ],
    externalAppsDependencies: ['8db68dd4-f18c-4811-8768-b636ce559df6'],
    metadata: { domain: 'commerce' },
    styles: [{ path: 'styles.css', integrity: INTEGRITY }],
    files: [
      {
        path: 'remoteEntry.js',
        digest: DIGEST,
        size: 100,
        mediaType: 'text/javascript; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        role: 'remote-entry',
      },
      {
        path: 'styles.css',
        digest: DIGEST,
        size: 20,
        mediaType: 'text/css; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        role: 'stylesheet',
      },
    ],
  };
}

function hostManifest(): Record<string, unknown> {
  return {
    schemaVersion: '2',
    kind: 'host-artifact',
    id: 'd145969d-8fe8-4b71-8aa4-8fb71fe54f63',
    name: 'storefront',
    preview: { number: 42, gitSha: 'abc123' },
    framework: 'angular',
    entryPath: 'remoteEntry.json',
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    files: [
      {
        path: 'remoteEntry.json',
        digest: DIGEST,
        size: 100,
        mediaType: 'application/json; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        role: 'remote-entry',
      },
    ],
  };
}

describe('release version validation', () => {
  it('should accept release version when value uses RFC 3986 unreserved characters', () => {
    expect(() => assertReleaseVersion('Release_1.2~candidate-3')).not.toThrow();
  });

  it.each([
    '',
    'latest',
    '.1',
    '-1',
    '_1',
    '~1',
    '1/2',
    '1+build',
    '1%20build',
    'rélease',
  ])('should reject release version when value is "%s"', (version: string) => {
    expect(() => assertReleaseVersion(version)).toThrow(
      /release version|release\.version/i,
    );
  });
});

describe('environment deployment validation', () => {
  it('should reject deployment when a selected release version is unsafe', () => {
    expect(() =>
      assertEnvironmentDeployment({
        schemaVersion: 'v1',
        environment: 'production',
        revision: DIGEST,
        updatedAt: '2026-08-26T00:00:00.000Z',
        hosts: { storefront: { version: '../unsafe' } },
        apps: {},
      }),
    ).toThrow(/release version/);
  });
});

describe('artifact id validation', () => {
  it('should reject artifact id when value could escape storage prefix', () => {
    expect(() => assertSafeArtifactId('../orders')).toThrow(
      /URL-safe path segment/,
    );
  });
});

describe('artifact path validation', () => {
  it.each(['assets/app%2Fsecret.js', 'entry.js?debug', 'entry.js#fragment'])(
    'should reject artifact path when URL semantics could change for "%s"',
    (path: string) => {
      expect(() => assertSafeRelativePath(path, 'files.path')).toThrow(
        /safe relative path/,
      );
    },
  );
});

describe('published artifact manifest validation', () => {
  it('should accept manifest when app artifact contains complete canonical shape', () => {
    expect(() => assertPublishedArtifactManifest(appManifest())).not.toThrow();
  });

  it('should accept app manifest when placement targets every host', () => {
    const manifest = appManifest();
    manifest.supportedHosts = ['*'];
    (manifest.placements as Array<Record<string, unknown>>).forEach(
      (placement) => {
        placement.hostId = '*';
      },
    );

    expect(() => assertPublishedArtifactManifest(manifest)).not.toThrow();
  });

  it('should accept manifest when host artifact contains complete canonical shape', () => {
    expect(() => assertPublishedArtifactManifest(hostManifest())).not.toThrow();
  });

  it.each([
    [
      'framework is unsupported',
      (manifest: Record<string, unknown>) => {
        manifest.framework = 'svelte';
      },
    ],
    [
      'entry expose is missing',
      (manifest: Record<string, unknown>) => {
        manifest.exposes = {};
      },
    ],
    [
      'SDK compatibility range is invalid',
      (manifest: Record<string, unknown>) => {
        manifest.requiredHostSdkVersion = 'not-a-range';
      },
    ],
    [
      'supported hosts are empty',
      (manifest: Record<string, unknown>) => {
        manifest.supportedHosts = [];
      },
    ],
    [
      'placement host is unsupported',
      (manifest: Record<string, unknown>) => {
        (manifest.placements as Array<Record<string, unknown>>)[0]!.hostId =
          'another-host';
      },
    ],
    [
      'widget owner differs from app',
      (manifest: Record<string, unknown>) => {
        (
          manifest.exportedWidgets as Array<Record<string, unknown>>
        )[0]!.ownerAppId = 'another-app';
      },
    ],
    [
      'external dependency is unsafe',
      (manifest: Record<string, unknown>) => {
        manifest.externalAppsDependencies = ['../billing'];
      },
    ],
    [
      'metadata contains nested value',
      (manifest: Record<string, unknown>) => {
        manifest.metadata = { nested: { value: true } };
      },
    ],
    [
      'file role is unsupported',
      (manifest: Record<string, unknown>) => {
        (manifest.files as Array<Record<string, unknown>>)[1]!.role =
          'document';
      },
    ],
    [
      'file media type is invalid',
      (manifest: Record<string, unknown>) => {
        (manifest.files as Array<Record<string, unknown>>)[1]!.mediaType =
          'css';
      },
    ],
    [
      'file cache policy is mutable',
      (manifest: Record<string, unknown>) => {
        (manifest.files as Array<Record<string, unknown>>)[1]!.cacheControl =
          'no-cache';
      },
    ],
    [
      'stylesheet descriptor is missing',
      (manifest: Record<string, unknown>) => {
        delete manifest.styles;
      },
    ],
    [
      'stylesheet integrity is invalid',
      (manifest: Record<string, unknown>) => {
        (manifest.styles as Array<Record<string, unknown>>)[0]!.integrity =
          'sha256-invalid';
      },
    ],
    [
      'stylesheet integrity differs from file digest',
      (manifest: Record<string, unknown>) => {
        (manifest.styles as Array<Record<string, unknown>>)[0]!.integrity =
          `sha256-${'A'.repeat(43)}=`;
      },
    ],
    [
      'redirect route defines a layout',
      (manifest: Record<string, unknown>) => {
        const placement = (
          manifest.placements as Array<Record<string, unknown>>
        )[0]!;
        placement.route = {
          path: '/legacy-orders',
          redirectTo: '/orders',
          layoutId: 'store',
        };
      },
    ],
    [
      'entry file role differs',
      (manifest: Record<string, unknown>) => {
        (manifest.files as Array<Record<string, unknown>>)[0]!.role = 'script';
      },
    ],
  ])(
    'should reject app manifest when %s',
    (
      _description: string,
      change: (manifest: Record<string, unknown>) => void,
    ) => {
      const manifest = appManifest();
      change(manifest);

      expect(() => assertPublishedArtifactManifest(manifest)).toThrow();
    },
  );

  it('should reject host manifest when loader compatibility is missing', () => {
    const manifest = hostManifest();
    delete manifest.requiredLoaderApiVersion;

    expect(() => assertPublishedArtifactManifest(manifest)).toThrow(
      /requiredLoaderApiVersion/,
    );
  });
});
