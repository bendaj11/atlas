import { faker } from '@faker-js/faker';
import {
  aDeploymentManifest,
  aHostCatalog,
  aHostManifest,
  aHostRuntimeConfig,
  aManifestDescriptor,
  anAppManifest,
} from '@atlas/testkit';
import { AtlasLoaderDriver } from './atlas-loader.driver.js';

describe('startAtlasLoader', () => {
  let driver: AtlasLoaderDriver;

  beforeEach(() => {
    driver = new AtlasLoaderDriver();
  });

  describe('when the runtime selects a deployed environment', () => {
    const runtime = aHostRuntimeConfig();
    const host = aHostManifest({ id: runtime.hostId });
    const app = anAppManifest();
    const widgetProvider = anAppManifest();
    const deployment = aDeploymentManifest({
      hostId: runtime.hostId,
      environment: runtime.environment,
      widgetProviders: [aManifestDescriptor()],
    });

    beforeEach(() => {
      driver.given
        .runtimeConfig(runtime)
        .given.deployment(deployment)
        .given.publishedArtifact(deployment.host, host)
        .given.publishedArtifact(deployment.apps[0]!, app)
        .given.publishedArtifact(
          deployment.widgetProviders![0]!,
          widgetProvider,
        );
    });

    describe('when started', () => {
      beforeEach(async () => {
        await driver.when.started();
      });

      it('should install the module shim when started', () => {
        expect(driver.get.installModuleShimMock()).toHaveBeenCalledTimes(1);
      });

      it('should fetch the environment manifest for the runtime host when started', () => {
        expect(driver.get.fetchBytesMock()).toHaveBeenCalledWith({
          url: `${runtime.artifactRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
          runtime,
        });
      });

      it('should load every deployment reference when started', () => {
        expect(
          driver.get
            .loadPublishedArtifactMock()
            .mock.calls.map(([{ reference }]) => reference),
        ).toEqual([
          deployment.host,
          ...deployment.apps,
          ...deployment.widgetProviders!,
        ]);
      });

      it('should apply overrides to the assembled catalog without a session when started', () => {
        expect(driver.get.applyOverridesMock()).toHaveBeenCalledWith({
          runtime,
          catalog: {
            schemaVersion: '1',
            hostId: runtime.hostId,
            revision: deployment.deploymentRevision,
            generatedAt: '1970-01-01T00:00:00.000Z',
            host,
            apps: [app],
            widgetProviders: [widgetProvider],
          },
        });
      });

      it('should mount the host with the assembled catalog when started', () => {
        expect(driver.get.mountedCatalog()).toEqual({
          schemaVersion: '1',
          hostId: runtime.hostId,
          revision: deployment.deploymentRevision,
          generatedAt: '1970-01-01T00:00:00.000Z',
          host,
          apps: [app],
          widgetProviders: [widgetProvider],
        });
      });

      it('should validate the effective catalog against the runtime when started', () => {
        expect(driver.get.validateCatalogMock()).toHaveBeenCalledWith({
          runtime,
          catalog: driver.get.mountedCatalog(),
        });
      });

      it('should publish the runtime snapshot as a JSON script when started', () => {
        expect(driver.get.createdSnapshot()).toEqual({
          id: 'atlas-runtime-snapshot',
          type: 'application/json',
          textContent: {
            schemaVersion: '1',
            runtime,
            catalog: driver.get.mountedCatalog(),
          },
        });
      });

      it('should load the host module for the effective host when started', () => {
        expect(driver.get.loadHostModuleMock()).toHaveBeenCalledWith({
          manifest: host,
          runtime,
        });
      });

      it('should clear the host root before mounting when started', () => {
        expect(driver.get.rootReplaceChildrenMock()).toHaveBeenCalledTimes(1);
      });

      it('should mount into the host root with the runtime when started', () => {
        expect(driver.get.mountRequest()).toMatchObject({
          container: expect.objectContaining({
            replaceChildren: expect.any(Function),
          }),
          runtimeConfig: runtime,
        });
      });
    });

    it('should omit widget providers when the deployment declares none', async () => {
      const plain = aDeploymentManifest({
        hostId: runtime.hostId,
        environment: runtime.environment,
      });
      driver.given
        .deployment(plain)
        .given.publishedArtifact(plain.host, host)
        .given.publishedArtifact(plain.apps[0]!, app);
      await driver.when.started();

      expect(driver.get.mountedCatalog()).not.toHaveProperty('widgetProviders');
    });

    it('should mount the overridden catalog when overrides change it', async () => {
      const overridden = aHostCatalog({ hostId: runtime.hostId });
      driver.given.overriddenCatalog(overridden);
      await driver.when.started();

      expect(driver.get.mountedCatalog()).toBe(overridden);
    });

    it('should update the existing snapshot script when one is already published', async () => {
      const existing = {
        id: 'atlas-runtime-snapshot',
        type: 'application/json',
        textContent: '',
      };
      driver.given.existingSnapshotElement(existing);
      await driver.when.started();

      expect(JSON.parse(existing.textContent)).toMatchObject({ runtime });
    });

    it('should mount through the default export when the module exposes mount there', async () => {
      const mount = async () => undefined;
      driver.given.hostModule({ default: { mount } });
      await driver.when.started();

      expect(driver.get.error()).toBeUndefined();
    });

    it('should load at most six artifacts at once when the deployment has many references', async () => {
      const references = Array.from({ length: 8 }, () => aManifestDescriptor());
      const many = aDeploymentManifest({
        hostId: runtime.hostId,
        environment: runtime.environment,
        apps: references,
      });
      driver.given.deployment(many).given.publishedArtifact(many.host, host);
      references.forEach((reference) =>
        driver.given.publishedArtifact(reference, app),
      );
      await driver.when.started();

      expect(driver.get.maximumArtifactLoads()).toBe(6);
    });

    it('should reject when the deployment manifest fails schema validation', async () => {
      driver.given.deployment({ ...deployment, kind: 'app' as never });
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: `Atlas deployment manifest at "${runtime.artifactRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json" is invalid: Invalid Atlas host deployment manifest. kind: Expected kind to be "host-deployment".`,
      });
    });

    it('should reject when the deployment targets another environment', async () => {
      const environment = faker.lorem.slug();
      driver.given.deployment({ ...deployment, environment });
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: `Atlas deployment manifest targets host "${runtime.hostId}" in environment "${environment}" but runtime selects host "${runtime.hostId}" in environment "${runtime.environment}".`,
      });
    });

    it('should reject when the deployment host reference resolves to an app', async () => {
      driver.given.publishedArtifact(deployment.host, anAppManifest());
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: `Atlas deployment manifest host reference "${deployment.host.path}" does not resolve to a host manifest.`,
      });
    });

    it('should reject when the page has no host root', async () => {
      driver.given.hostRootPresent(false);
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MOUNT_FAILED',
        summary:
          'Atlas bootstrap page has no element with id="atlas-host-root".',
      });
    });

    it('should reject when the host module exports no mount function', async () => {
      driver.given.hostModule({});
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_MOUNT_FAILED',
        summary: `Selected host client "${runtime.hostId}" does not export mount(request).`,
      });
    });
  });

  describe('when the runtime names a development session', () => {
    const developmentSessionUrl = 'http://localhost:4400/session.json';
    const runtime = aHostRuntimeConfig({
      environment: 'development',
      developmentSessionUrl,
    });
    const catalog = aHostCatalog({ hostId: runtime.hostId });
    const session = { hostId: runtime.hostId, catalog, overrides: [] };

    beforeEach(() => {
      driver.given.runtimeConfig(runtime);
    });

    describe('when the session includes a catalog', () => {
      beforeEach(async () => {
        driver.given.developmentSession(session);
        await driver.when.started();
      });

      it('should fetch the development session when started', () => {
        expect(driver.get.fetchJsonMock()).toHaveBeenCalledWith({
          url: developmentSessionUrl,
          runtime,
        });
      });

      it('should not fetch a deployment manifest when started', () => {
        expect(driver.get.fetchBytesMock()).not.toHaveBeenCalled();
      });

      it('should apply overrides with the fetched session when started', () => {
        expect(driver.get.applyOverridesMock()).toHaveBeenCalledWith({
          runtime,
          catalog,
          developmentSession: session,
        });
      });

      it('should mount the session catalog when started', () => {
        expect(driver.get.mountedCatalog()).toBe(catalog);
      });
    });

    it('should reject when the session has no catalog', async () => {
      driver.given.developmentSession({ hostId: runtime.hostId });
      await driver.when.started();

      expect(driver.get.error()).toMatchObject({
        code: 'CATALOG_INVALID',
        summary: `Atlas development session at "${developmentSessionUrl}" does not include a host catalog.`,
      });
    });
  });
});
