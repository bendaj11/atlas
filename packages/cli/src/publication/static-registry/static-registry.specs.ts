import { faker } from '@faker-js/faker';
import { describe, expect, it } from '@jest/globals';
import type {
  AtlasAppArtifactManifest,
  AtlasHostArtifactManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import {
  bindHostDeployment,
  emptyStaticRegistry,
  importRelease,
  publishArtifact,
  resolveRegistryArtifact,
  resolveRelease,
  selectDeployment,
} from './static-registry.js';

describe('static registry v2', () => {
  it('should store only a descriptor when a release is published', () => {
    const manifest = releaseManifest('1.4.0');
    const descriptor = manifestDescriptor(manifest, '1.4.0');

    const result = publishArtifact(undefined, manifest, descriptor);

    expect(result.registry.apps[manifest.id]?.releases['1.4.0']).toStrictEqual(
      descriptor,
    );
  });

  it('should keep latest unchanged when an identical release is republished', () => {
    const manifest = releaseManifest('1.4.0');
    const descriptor = manifestDescriptor(manifest, '1.4.0');
    const current = publishArtifact(undefined, manifest, descriptor).registry;

    const result = publishArtifact(current, manifest, descriptor);

    expect(result.changed).toBe(false);
  });

  it('should reject changed bytes when a version already exists', () => {
    const manifest = releaseManifest('1.4.0');
    const descriptor = {
      ...manifestDescriptor(manifest, '1.4.0'),
      digest: sha256('a'),
    };
    const current = publishArtifact(undefined, manifest, descriptor).registry;

    expect(() =>
      publishArtifact(current, manifest, {
        ...descriptor,
        digest: sha256('b'),
      }),
    ).toThrow(/different digest/);
  });

  it('should resolve latest through the explicit latest pointer', () => {
    const manifest = releaseManifest('opaque-7');
    const registry = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, 'opaque-7'),
    ).registry;

    const selected = resolveRelease(registry, manifest.name, 'latest');

    expect(selected.version).toBe('opaque-7');
  });

  it('should resolve artifact through package name when release is published', () => {
    const manifest = {
      ...releaseManifest('opaque-7'),
      packageName: faker.internet.domainWord(),
    };
    const registry = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, 'opaque-7'),
    ).registry;

    expect(
      resolveRegistryArtifact(registry, manifest.packageName).artifact.id,
    ).toBe(manifest.id);
  });

  it('should retain package name when a release is imported', () => {
    const manifest = {
      ...releaseManifest('opaque-7'),
      packageName: faker.internet.domainWord(),
    };
    const source = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, 'opaque-7'),
    ).registry;
    const target = importRelease(
      emptyStaticRegistry(),
      resolveRelease(source, manifest.packageName, 'opaque-7'),
    );

    expect(
      resolveRegistryArtifact(target, manifest.packageName).artifact.id,
    ).toBe(manifest.id);
  });

  it('should resolve an environment to its exact selected release', () => {
    const manifest = releaseManifest('1.4.0');
    const published = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, '1.4.0'),
    ).registry;
    const selected = resolveRelease(published, manifest.id, '1.4.0');
    const deployed = selectDeployment(published, 'rc', selected, {}).registry;

    const resolved = resolveRelease(deployed, manifest.id, 'rc');

    expect(resolved.version).toBe('1.4.0');
  });

  it('should store only the exact version when a release is selected', () => {
    const manifest = releaseManifest('1.4.0');
    const published = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, '1.4.0'),
    ).registry;

    const deployed = selectDeployment(
      published,
      'production',
      resolveRelease(published, manifest.id, '1.4.0'),
      {},
    ).registry;

    expect(deployed.deployments.production?.apps[manifest.id]).toStrictEqual({
      version: '1.4.0',
    });
  });

  it('should reject an environment name that collides with a release', () => {
    const manifest = releaseManifest('production');
    const registry = publishArtifact(
      emptyStaticRegistry(),
      manifest,
      manifestDescriptor(manifest, 'production'),
    ).registry;
    const selected = resolveRelease(registry, manifest.id, 'production');

    expect(() =>
      selectDeployment(registry, 'production', selected, {}),
    ).toThrow(/conflicts with an existing release/);
  });

  it('should store normalized URLs when host deployment is bound', () => {
    const manifest = hostReleaseManifest('1.4.0');
    const published = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, '1.4.0'),
    ).registry;
    const selected = resolveRelease(published, manifest.id, '1.4.0');
    const deployed = selectDeployment(
      published,
      'production',
      selected,
      {},
    ).registry;

    const bound = bindHostDeployment(deployed, {
      environment: 'production',
      hostId: manifest.id,
      baseUrls: ['https://customer.example.com/portal/'],
    }).registry;

    expect(
      bound.deployments.production?.hosts[manifest.id]?.baseUrls,
    ).toStrictEqual(['https://customer.example.com/portal']);
  });

  it('should reject host URL when another environment already owns it', () => {
    const manifest = hostReleaseManifest('1.4.0');
    const published = publishArtifact(
      undefined,
      manifest,
      manifestDescriptor(manifest, '1.4.0'),
    ).registry;
    const selected = resolveRelease(published, manifest.id, '1.4.0');
    const production = selectDeployment(
      published,
      'production',
      selected,
      {},
    ).registry;
    const bound = bindHostDeployment(production, {
      environment: 'production',
      hostId: manifest.id,
      baseUrls: ['https://customer.example.com'],
    }).registry;
    const staging = selectDeployment(bound, 'staging', selected, {}).registry;

    expect(() =>
      bindHostDeployment(staging, {
        environment: 'staging',
        hostId: manifest.id,
        baseUrls: ['https://customer.example.com'],
      }),
    ).toThrow(/already bound/);
  });
});

function releaseManifest(version: string): AtlasAppArtifactManifest {
  const id = faker.string.uuid();
  return {
    schemaVersion: '2',
    kind: 'app-artifact',
    id,
    name: faker.word.noun(),
    release: { version },
    framework: 'react',
    entryPath: 'remoteEntry.json',
    exposes: { entry: './entry' },
    files: [
      {
        path: 'remoteEntry.json',
        digest: sha256('e'),
        size: 1,
        mediaType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
        role: 'remote-entry',
      },
    ],
    requiredHostSdkVersion: '^0.1.0',
    supportedHosts: ['*'],
    placements: [],
  };
}

function hostReleaseManifest(version: string): AtlasHostArtifactManifest {
  const app = releaseManifest(version);
  return {
    schemaVersion: '2',
    kind: 'host-artifact',
    id: app.id,
    name: app.name,
    release: { version },
    framework: app.framework,
    entryPath: app.entryPath,
    exposes: app.exposes,
    files: app.files,
    requiredLoaderApiVersion: '^1.0.0',
  };
}

function manifestDescriptor(
  manifest: AtlasAppArtifactManifest | AtlasHostArtifactManifest,
  version: string,
): AtlasManifestDescriptor {
  return {
    path: `apps/${manifest.id}/${version}/manifest.json`,
    digest: sha256(
      faker.string
        .hexadecimal({ length: 1, prefix: '' })
        .slice(-1)
        .toLowerCase(),
    ),
    size: faker.number.int({ min: 1 }),
    mediaType: 'application/json',
  };
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${value.padEnd(64, '0').slice(0, 64)}`;
}
