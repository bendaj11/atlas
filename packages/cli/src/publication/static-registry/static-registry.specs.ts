import { faker } from '@faker-js/faker';
import { describe, expect, it } from '@jest/globals';
import type { AtlasAppArtifactManifest, AtlasManifestDescriptor } from '@atlas/schema';
import { emptyStaticRegistry, publishArtifact, resolveRegistryArtifact, resolveRelease } from './static-registry.js';

describe('static registry v2', () => {
  it('should omit environment deployments when empty registry is created', () => {
    expect(emptyStaticRegistry()).not.toHaveProperty('deployments');
  });

  it('should store descriptor when immutable release is published', () => {
    const manifest = releaseManifest();
    const descriptor = descriptorFor(manifest);

    expect(publishArtifact(undefined, manifest, descriptor).registry.apps[manifest.id]?.releases['1.4.0']).toStrictEqual(descriptor);
  });

  it('should resolve latest from immutable artifact catalog when latest is requested', () => {
    const manifest = releaseManifest();
    const registry = publishArtifact(undefined, manifest, descriptorFor(manifest)).registry;

    expect(resolveRelease(registry, manifest.id, 'latest').version).toBe('1.4.0');
  });

  it('should resolve artifact through package name when package name is unique', () => {
    const manifest = { ...releaseManifest(), packageName: faker.internet.domainWord() };
    const registry = publishArtifact(undefined, manifest, descriptorFor(manifest)).registry;

    expect(resolveRegistryArtifact(registry, manifest.packageName).artifact.id).toBe(manifest.id);
  });
});

function releaseManifest(): AtlasAppArtifactManifest { return { schemaVersion: '2', kind: 'app-artifact', id: faker.string.uuid(), name: faker.word.noun(), release: { version: '1.4.0' }, framework: 'react', entryPath: 'remoteEntry.js', exposes: { entry: './entry' }, files: [{ path: 'remoteEntry.js', digest: sha256('entry'), size: 5, mediaType: 'application/javascript', cacheControl: 'public, max-age=31536000, immutable', role: 'remote-entry' }], requiredHostSdkVersion: '^1.0.0', supportedHosts: ['*'], placements: [] }; }
function descriptorFor(manifest: AtlasAppArtifactManifest): AtlasManifestDescriptor { return { path: `apps/${manifest.id}/1.4.0/manifest.json`, digest: sha256(manifest.id), size: faker.number.int({ min: 1 }), mediaType: 'application/json' }; }
function sha256(_value: string): `sha256:${string}` { return `sha256:${'a'.repeat(64)}`; }
