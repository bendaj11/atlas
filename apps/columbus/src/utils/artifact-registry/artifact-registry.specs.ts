/** @jest-environment node */

import { faker } from '@faker-js/faker';
import { aHostRuntimeConfig, anAppManifest } from '@atlas/testkit';
import { aRegistryUrl } from '@atlas/testkit/internal';
import {
  aRegistry,
  aRegistryArtifactOf,
  aPublishedArtifact,
} from '../../testkit/registry.testkit';
import { ArtifactRegistryDriver } from './artifact-registry.driver';

const { createArtifactRegistry, registryRootFor, uniqueManifests } =
  await import('./artifact-registry');

describe('createArtifactRegistry', () => {
  let driver: ArtifactRegistryDriver;

  beforeEach(() => {
    driver = new ArtifactRegistryDriver();
  });

  describe('readRegistry', () => {
    it('should fetch the registry document under the root when read', async () => {
      const root = aRegistryUrl();

      driver.given.registryResponse(Response.json(aRegistry()));

      await createArtifactRegistry().readRegistry(root);

      expect(driver.get.fetchWithTimeout()).toHaveBeenCalledWith(
        `${root}/registry.json`,
      );
    });

    it('should return the registry when the document is valid', async () => {
      const registry = aRegistry();

      driver.given.registryResponse(Response.json(registry));

      await expect(
        createArtifactRegistry().readRegistry(aRegistryUrl()),
      ).resolves.toEqual(registry);
    });

    it('should reject when the registry responds with an error status', async () => {
      driver.given.registryResponse(new Response(null, { status: 404 }));

      await expect(
        createArtifactRegistry().readRegistry(aRegistryUrl()),
      ).rejects.toThrow('Atlas registry returned 404.');
    });

    it('should reject when the registry document has the wrong shape', async () => {
      driver.given.registryResponse(Response.json({ schemaVersion: '1' }));

      await expect(
        createArtifactRegistry().readRegistry(aRegistryUrl()),
      ).rejects.toThrow('Atlas registry returned invalid data.');
    });

    it('should reject when a registered app is not a registry artifact', async () => {
      driver.given.registryResponse(
        Response.json({
          schemaVersion: '2',
          apps: { [faker.string.uuid()]: null },
          hosts: {},
        }),
      );

      await expect(
        createArtifactRegistry().readRegistry(aRegistryUrl()),
      ).rejects.toThrow('Atlas registry returned invalid data.');
    });
  });

  describe('readVersions', () => {
    it('should reject when the artifact is not registered', async () => {
      const deployed = anAppManifest();

      await expect(
        createArtifactRegistry().readVersions(
          deployed,
          aRegistry(),
          aRegistryUrl(),
        ),
      ).rejects.toThrow(`Artifact ${deployed.id} is not registered.`);
    });

    describe('when the app has two releases', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const older = aPublishedArtifact(
        anAppManifest({
          id: deployed.id,
          channel: 'production',
          version: '1.0.0',
        }),
      );
      const latest = aPublishedArtifact(
        anAppManifest({
          id: deployed.id,
          channel: 'production',
          version: '2.0.0',
        }),
      );
      const registry = aRegistry({
        apps: { [deployed.id]: aRegistryArtifactOf(deployed, [older, latest]) },
      });

      it('should list the canonical production releases newest first when read', async () => {
        await expect(
          createArtifactRegistry().readVersions(
            deployed,
            registry,
            aRegistryUrl(),
          ),
        ).resolves.toStrictEqual({
          manifests: [
            {
              ...deployed,
              version: '2.0.0',
              buildId: 'canonical',
              channel: 'production',
            },
            {
              ...deployed,
              version: '1.0.0',
              buildId: 'canonical',
              channel: 'production',
            },
          ],
        });
      });

      it('should not fetch any manifest when read', async () => {
        await createArtifactRegistry().readVersions(
          deployed,
          registry,
          aRegistryUrl(),
        );

        expect(driver.get.fetchVerifiedManifest()).not.toHaveBeenCalled();
      });
    });

    describe('when the app has a preview', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const preview = aPublishedArtifact(
        anAppManifest({
          id: deployed.id,
          channel: 'pr',
          prNumber: faker.number.int({ min: 1, max: 9999 }),
        }),
      );
      const registry = aRegistry({
        apps: { [deployed.id]: aRegistryArtifactOf(deployed, [preview]) },
      });

      it('should fetch the preview manifest at its registry reference when read', async () => {
        const root = aRegistryUrl();

        driver.given.manifest(preview.manifest);

        await createArtifactRegistry().readVersions(deployed, registry, root);

        expect(driver.get.fetchVerifiedManifest()).toHaveBeenCalledWith({
          ...preview.descriptor,
          url: `${root}/${preview.path}`,
        });
      });

      it('should list the fetched preview manifest when read', async () => {
        driver.given.manifest(preview.manifest);

        await expect(
          createArtifactRegistry().readVersions(
            deployed,
            registry,
            aRegistryUrl(),
          ),
        ).resolves.toStrictEqual({ manifests: [preview.manifest] });
      });

      it('should report the preview as unavailable when its manifest cannot be fetched', async () => {
        const reason = faker.lorem.sentence();

        driver.given.manifestFailure(new Error(reason));

        await expect(
          createArtifactRegistry().readVersions(
            deployed,
            registry,
            aRegistryUrl(),
          ),
        ).resolves.toStrictEqual({
          manifests: [],
          error: `Preview ${preview.manifest.prNumber} is unavailable: ${reason}`,
        });
      });
    });
  });

  describe('loadVersion', () => {
    it('should reject when the version was never listed', async () => {
      await expect(
        createArtifactRegistry().loadVersion(
          faker.string.uuid(),
          faker.string.uuid(),
        ),
      ).rejects.toThrow('Selected artifact version is unavailable.');
    });

    describe('when a release was listed', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const release = aPublishedArtifact(
        anAppManifest({
          id: deployed.id,
          channel: 'production',
          version: '2.0.0',
          buildId: 'canonical',
        }),
      );
      const registry = aRegistry({
        apps: { [deployed.id]: aRegistryArtifactOf(deployed, [release]) },
      });

      it('should return the fetched release manifest when loaded', async () => {
        const artifactRegistry = createArtifactRegistry();

        driver.given.manifest(release.manifest);

        await artifactRegistry.readVersions(deployed, registry, aRegistryUrl());

        await expect(
          artifactRegistry.loadVersion(
            deployed.id,
            'production:2.0.0:canonical',
          ),
        ).resolves.toBe(release.manifest);
      });

      it('should reject when the fetched manifest does not match the listed version', async () => {
        const artifactRegistry = createArtifactRegistry();

        driver.given.manifest(
          anAppManifest({
            id: deployed.id,
            channel: 'production',
            version: '3.0.0',
          }),
        );

        await artifactRegistry.readVersions(deployed, registry, aRegistryUrl());

        await expect(
          artifactRegistry.loadVersion(
            deployed.id,
            'production:2.0.0:canonical',
          ),
        ).rejects.toThrow(
          'Selected artifact manifest does not match its registry entry.',
        );
      });
    });

    it('should fetch the preview manifest once when the preview was listed and is loaded', async () => {
      const deployed = anAppManifest({ channel: 'production' });
      const preview = aPublishedArtifact(
        anAppManifest({
          id: deployed.id,
          channel: 'pr',
          prNumber: faker.number.int({ min: 1, max: 9999 }),
        }),
      );
      const registry = aRegistry({
        apps: { [deployed.id]: aRegistryArtifactOf(deployed, [preview]) },
      });
      const artifactRegistry = createArtifactRegistry();

      driver.given.manifest(preview.manifest);

      await artifactRegistry.readVersions(deployed, registry, aRegistryUrl());
      await artifactRegistry.loadVersion(
        deployed.id,
        `pr:${preview.manifest.prNumber}:${preview.manifest.buildId}`,
      );

      expect(driver.get.fetchVerifiedManifest()).toHaveBeenCalledTimes(1);
    });
  });
});

describe('registryRootFor', () => {
  it('should strip the trailing slash when the environment is not development', () => {
    expect(
      registryRootFor(
        aHostRuntimeConfig({
          environment: 'production',
          artifactRegistryUrl: 'https://registry.example/',
        }),
      ),
    ).toBe('https://registry.example');
  });

  it('should return nothing when the registry url is empty', () => {
    expect(
      registryRootFor(aHostRuntimeConfig({ artifactRegistryUrl: '' })),
    ).toBeUndefined();
  });

  it('should return nothing when development serves the registry from the control server', () => {
    expect(
      registryRootFor(
        aHostRuntimeConfig({
          environment: 'development',
          artifactRegistryUrl: 'http://localhost:4400',
          developmentSessionUrl: 'http://localhost:4400/atlas.dev-session.json',
        }),
      ),
    ).toBeUndefined();
  });

  it('should keep the registry url when development uses a separate registry', () => {
    expect(
      registryRootFor(
        aHostRuntimeConfig({
          environment: 'development',
          artifactRegistryUrl: 'https://registry.example',
          developmentSessionUrl: 'http://localhost:4400/atlas.dev-session.json',
        }),
      ),
    ).toBe('https://registry.example');
  });
});

describe('uniqueManifests', () => {
  it('should keep one manifest per kind, id, channel, and version when duplicates exist', () => {
    const repeated = anAppManifest();
    const other = anAppManifest();

    expect(uniqueManifests([repeated, repeated, other])).toStrictEqual([
      repeated,
      other,
    ]);
  });
});
