import { faker } from '@faker-js/faker';
import type { AtlasHostDeploymentManifest } from '@atlas/schema';
import {
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  anAppManifest,
} from '@atlas/testkit';
import { aPublishedArtifact } from '../../testkit/registry.testkit';
import { HostCatalogDriver } from './host-catalog.driver';

const { readCatalog, readRuntimeConfig } = await import('./host-catalog');

describe('readRuntimeConfig', () => {
  let driver: HostCatalogDriver;

  beforeEach(() => {
    driver = new HostCatalogDriver();
  });

  it('should fetch the runtime config from the page root when read', async () => {
    driver.given
      .pageLocation(faker.internet.url())
      .given.fetchJson(aHostRuntimeConfig());

    await readRuntimeConfig();

    expect(driver.get.fetchWithTimeout()).toHaveBeenCalledWith(
      '/atlas.runtime.json',
    );
  });

  it('should resolve the runtime config when the page serves it', async () => {
    const config = aHostRuntimeConfig({
      environment: 'production',
      artifactRegistryUrl: 'https://registry.example',
    });

    driver.given.pageLocation(faker.internet.url()).given.fetchJson(config);

    await expect(readRuntimeConfig()).resolves.toMatchObject({
      hostId: config.hostId,
      environment: 'production',
      artifactRegistryUrl: 'https://registry.example',
    });
  });

  it('should reject when the runtime config responds with an error status', async () => {
    driver.given.fetchStatus(500);

    await expect(readRuntimeConfig()).rejects.toThrow(
      'Atlas runtime config returned 500.',
    );
  });
});

describe('readCatalog', () => {
  let driver: HostCatalogDriver;

  beforeEach(() => {
    driver = new HostCatalogDriver();
  });

  describe('when the environment is production', () => {
    const config = aHostRuntimeConfig({
      environment: 'production',
      artifactRegistryUrl: 'https://registry.example',
    });
    const host = aPublishedArtifact(aHostManifest({ id: config.hostId }));
    const app = aPublishedArtifact(anAppManifest());
    const deployment: AtlasHostDeploymentManifest = {
      schemaVersion: 'v1',
      kind: 'host-deployment',
      hostId: config.hostId,
      environment: 'production',
      deploymentRevision: `sha256:${faker.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' })}`,
      host: host.descriptor,
      apps: [app.descriptor],
    };

    it('should fetch the environment manifest under the registry when read', async () => {
      driver.given
        .fetchJson(deployment)
        .given.manifest(host.manifest)
        .given.manifest(app.manifest);

      await readCatalog(config, driver.get.loadManifest());

      expect(driver.get.fetchWithTimeout()).toHaveBeenCalledWith(
        `https://registry.example/environments/production/hosts/${config.hostId}/manifest.json`,
      );
    });

    it('should load each deployment reference under the registry when read', async () => {
      driver.given
        .fetchJson(deployment)
        .given.manifest(host.manifest)
        .given.manifest(app.manifest);

      await readCatalog(config, driver.get.loadManifest());

      expect(driver.get.loadManifest().mock.calls).toStrictEqual([
        [{ ...host.descriptor, url: `https://registry.example/${host.path}` }],
        [{ ...app.descriptor, url: `https://registry.example/${app.path}` }],
      ]);
    });

    it('should return the deployed host and apps when the deployment is valid', async () => {
      driver.given
        .fetchJson(deployment)
        .given.manifest(host.manifest)
        .given.manifest(app.manifest);

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).resolves.toMatchObject({
        hostId: config.hostId,
        revision: deployment.deploymentRevision,
        host: host.manifest,
        apps: [app.manifest],
      });
    });

    it('should reject when the deployment responds with an error status', async () => {
      driver.given.fetchStatus(404);

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas host manifest returned 404.');
    });

    it('should reject when the deployment targets another environment', async () => {
      driver.given.fetchJson({ ...deployment, environment: faker.word.noun() });

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas host manifest returned invalid data.');
    });

    it('should reject when the deployment targets another host', async () => {
      driver.given.fetchJson({ ...deployment, hostId: faker.string.uuid() });

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas host manifest returned invalid data.');
    });

    it('should reject when the loaded host manifest is not a host', async () => {
      driver.given
        .fetchJson(deployment)
        .given.manifest(anAppManifest())
        .given.manifest(app.manifest);

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Host selection is invalid.');
    });
  });

  describe('when the environment is development', () => {
    const config = aHostRuntimeConfig({
      environment: 'development',
      developmentSessionUrl: `http://localhost:${faker.internet.port()}/atlas.dev-session.json`,
    });

    describe('when the page embeds a runtime snapshot for the host', () => {
      const catalog = aHostCatalog({ hostId: config.hostId });

      beforeEach(() => {
        driver.given.runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: config.hostId, environment: 'development' },
          catalog,
        });
      });

      it('should return the snapshot catalog when read', async () => {
        await expect(
          readCatalog(config, driver.get.loadManifest()),
        ).resolves.toEqual(catalog);
      });

      it('should not fetch anything when read', async () => {
        await readCatalog(config, driver.get.loadManifest());

        expect(driver.get.fetchWithTimeout()).not.toHaveBeenCalled();
      });
    });

    it('should fetch the development session when the snapshot targets another host', async () => {
      const otherHostId = faker.string.uuid();

      driver.given
        .runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: otherHostId, environment: 'development' },
          catalog: aHostCatalog({ hostId: otherHostId }),
        })
        .given.fetchJson({ catalog: aHostCatalog({ hostId: config.hostId }) });

      await readCatalog(config, driver.get.loadManifest());

      expect(driver.get.fetchWithTimeout()).toHaveBeenCalledWith(
        config.developmentSessionUrl,
      );
    });

    it('should fetch the development session when the snapshot catalog is not a host catalog', async () => {
      driver.given
        .runtimeSnapshot({
          schemaVersion: '1',
          runtime: { hostId: config.hostId, environment: 'development' },
          catalog: null,
        })
        .given.fetchJson({ catalog: aHostCatalog({ hostId: config.hostId }) });

      await readCatalog(config, driver.get.loadManifest());

      expect(driver.get.fetchWithTimeout()).toHaveBeenCalledWith(
        config.developmentSessionUrl,
      );
    });

    it('should return the development session catalog when no snapshot exists', async () => {
      const catalog = aHostCatalog({ hostId: config.hostId });

      driver.given.fetchJson({ catalog });

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).resolves.toEqual(catalog);
    });

    it('should reject when the development session url is missing', async () => {
      await expect(
        readCatalog(
          { ...config, developmentSessionUrl: undefined },
          driver.get.loadManifest(),
        ),
      ).rejects.toThrow('Atlas development session URL is missing.');
    });

    it('should reject when the development session responds with an error status', async () => {
      driver.given.fetchStatus(503);

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas development session returned 503.');
    });

    it('should reject when the development session catalog targets another host', async () => {
      driver.given.fetchJson({
        catalog: aHostCatalog({ hostId: faker.string.uuid() }),
      });

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas development session returned invalid data.');
    });

    it('should reject when the development session catalog is not a host catalog', async () => {
      driver.given.fetchJson({ catalog: null });

      await expect(
        readCatalog(config, driver.get.loadManifest()),
      ).rejects.toThrow('Atlas development session returned invalid data.');
    });
  });
});
