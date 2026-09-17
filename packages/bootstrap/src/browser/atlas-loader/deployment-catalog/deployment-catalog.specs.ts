import { faker } from '@faker-js/faker';
import {
  aDeploymentManifest,
  aHostManifest,
  aHostRuntimeConfig,
  aManifestDescriptor,
  anAppManifest,
} from '@atlas/testkit';
import { DeploymentCatalogDriver } from './deployment-catalog.driver.js';

describe('loadDeploymentCatalog', () => {
  let driver: DeploymentCatalogDriver;

  beforeEach(() => {
    driver = new DeploymentCatalogDriver();
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
        .runtime(runtime)
        .given.deployment(deployment)
        .given.publishedArtifact(deployment.host, host)
        .given.publishedArtifact(deployment.apps[0]!, app)
        .given.publishedArtifact(
          deployment.widgetProviders![0]!,
          widgetProvider,
        );
    });

    it('should fetch the environment manifest for the runtime host when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.fetchBytesMock()).toHaveBeenCalledWith({
        url: `${runtime.artifactRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json`,
        runtime,
      });
    });

    it('should load every deployment reference in order when loaded', async () => {
      await driver.when.loaded();

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

    it('should assemble the catalog from the loaded manifests when loaded', async () => {
      await driver.when.loaded();

      expect(driver.get.catalog()).toEqual({
        schemaVersion: '1',
        hostId: runtime.hostId,
        revision: deployment.deploymentRevision,
        generatedAt: '1970-01-01T00:00:00.000Z',
        host,
        apps: [app],
        widgetProviders: [widgetProvider],
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
      await driver.when.loaded();

      expect(driver.get.catalog()).not.toHaveProperty('widgetProviders');
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
      await driver.when.loaded();

      expect(driver.get.maximumArtifactLoads()).toBe(6);
    });

    it('should reject when the deployment manifest fails schema validation', async () => {
      driver.given.deployment({ ...deployment, kind: 'app' });
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: expect.stringMatching(
          `^Atlas deployment manifest at "${runtime.artifactRegistryUrl}/environments/${runtime.environment}/hosts/${runtime.hostId}/manifest.json" is invalid: `,
        ),
      });
    });

    it('should reject when the deployment targets another environment', async () => {
      const environment = faker.word.noun();
      driver.given.deployment({ ...deployment, environment });
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: `Atlas deployment manifest targets host "${runtime.hostId}" in environment "${environment}" but runtime selects host "${runtime.hostId}" in environment "${runtime.environment}".`,
      });
    });

    it('should reject when the deployment host reference resolves to an app', async () => {
      driver.given.publishedArtifact(deployment.host, anAppManifest());
      await driver.when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'DEPLOYMENT_INVALID',
        summary: `Atlas deployment manifest host reference "${deployment.host.path}" does not resolve to a host manifest.`,
      });
    });
  });
});
