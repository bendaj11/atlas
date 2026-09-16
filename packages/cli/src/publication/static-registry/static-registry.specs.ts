import { faker } from '@faker-js/faker';
import { aManifestDescriptor, anAppArtifactManifest } from '@atlas/testkit';
import {
  emptyStaticRegistry,
  publishArtifact,
  resolveRegistryArtifact,
  resolveRelease,
} from './static-registry.js';

describe('static registry v2', () => {
  it('should omit environment deployments when empty registry is created', () => {
    expect(emptyStaticRegistry()).not.toHaveProperty('deployments');
  });

  it('should store descriptor when immutable release is published', () => {
    const version = faker.system.semver();
    const manifest = anAppArtifactManifest({ release: { version } });
    const descriptor = aManifestDescriptor();

    expect(
      publishArtifact(undefined, manifest, descriptor).registry.apps[
        manifest.id
      ]?.releases[version],
    ).toStrictEqual(descriptor);
  });

  it('should resolve latest from immutable artifact catalog when latest is requested', () => {
    const version = faker.system.semver();
    const manifest = anAppArtifactManifest({ release: { version } });
    const registry = publishArtifact(
      undefined,
      manifest,
      aManifestDescriptor(),
    ).registry;

    expect(resolveRelease(registry, manifest.id, 'latest').version).toBe(
      version,
    );
  });

  it('should resolve artifact through package name when package name is unique', () => {
    const packageName = faker.internet.domainWord();
    const manifest = anAppArtifactManifest({ packageName });
    const registry = publishArtifact(
      undefined,
      manifest,
      aManifestDescriptor(),
    ).registry;

    expect(resolveRegistryArtifact(registry, packageName).artifact.id).toBe(
      manifest.id,
    );
  });
});
