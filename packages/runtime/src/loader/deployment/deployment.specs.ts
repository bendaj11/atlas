import { faker } from '@faker-js/faker';
import type { AtlasHostArtifactManifest } from '@atlas/schema';
import {
  aHostArtifactManifest,
  aManifestDescriptor,
  anAppArtifactManifest,
} from '@atlas/testkit/internal';
import { DeploymentDriver } from './deployment.driver.js';
import { aDeploymentWith, aReferenceTo } from './deployment.testkit.js';
import type { DeploymentManifestReference } from './deployment.types.js';

describe('loadHostDeployment', () => {
  let driver: DeploymentDriver;

  beforeEach(() => {
    driver = new DeploymentDriver();
  });

  describe('when the deployment references a host and apps that hash correctly', () => {
    const hostArtifact = aHostArtifactManifest();
    const appArtifact = anAppArtifactManifest();
    const providerArtifact = anAppArtifactManifest();

    it('should return the hydrated host, apps, and widget providers when loaded', async () => {
      const host = await aReferenceTo(hostArtifact);
      const app = await aReferenceTo(appArtifact);
      const provider = await aReferenceTo(providerArtifact);
      await driver.given
        .deployment(
          aDeploymentWith({ host, apps: [app], widgetProviders: [provider] }),
        )
        .given.artifactAt(host.url!, hostArtifact)
        .given.artifactAt(app.url!, appArtifact)
        .given.artifactAt(provider.url!, providerArtifact)
        .when.loaded();

      expect(driver.get.catalog()).toMatchObject({
        host: { id: hostArtifact.id, kind: 'host' },
        apps: [{ id: appArtifact.id, kind: 'app' }],
        widgetProviders: [{ id: providerArtifact.id, kind: 'app' }],
      });
    });

    it('should fetch each artifact manifest once when loaded twice with the same manifest cache', async () => {
      const host = await aReferenceTo(hostArtifact);
      const app = await aReferenceTo(appArtifact);
      await driver.given
        .manifestCache(new Map())
        .given.deployment(aDeploymentWith({ host, apps: [app] }))
        .given.artifactAt(host.url!, hostArtifact)
        .given.artifactAt(app.url!, appArtifact)
        .when.loaded();

      await driver.when.loaded();

      expect(driver.get.fetchBytesMock()).toHaveBeenCalledTimes(4);
    });

    it('should resolve a reference path against artifactRegistryUrl when the reference has no url', async () => {
      const registryUrl = faker.internet.url({ appendSlash: false });
      const host = await aReferenceTo(hostArtifact, { url: undefined });
      await driver.given
        .artifactRegistryUrl(registryUrl)
        .given.deployment(aDeploymentWith({ host }))
        .given.artifactAt(`${registryUrl}/${host.path}`, hostArtifact)
        .when.loaded();

      expect(driver.get.catalog().host.id).toBe(hostArtifact.id);
    });

    describe('when an app manifest digest differs from its descriptor', () => {
      let app: DeploymentManifestReference;

      beforeEach(async () => {
        const host = await aReferenceTo(hostArtifact);
        const provider = await aReferenceTo(providerArtifact);
        app = await aReferenceTo(appArtifact, {
          digest: aManifestDescriptor().digest,
        });

        await driver.given
          .deployment(
            aDeploymentWith({ host, apps: [app], widgetProviders: [provider] }),
          )
          .given.artifactAt(host.url!, hostArtifact)
          .given.artifactAt(app.url!, appArtifact)
          .given.artifactAt(provider.url!, providerArtifact)
          .when.loaded();
      });

      it('should return the catalog without the rejected app when loaded', () => {
        expect(driver.get.catalog()).toMatchObject({
          host: { id: hostArtifact.id },
          apps: [],
          widgetProviders: [{ id: providerArtifact.id }],
        });
      });

      it('should log the skipped app reference when loaded', () => {
        expect(driver.get.logErrorMock()).toHaveBeenCalledWith(
          `Atlas skipped "${app.path}" because its manifest could not be loaded. The rest of the host still loads.`,
          expect.any(Error),
        );
      });
    });

    describe('when a widget provider manifest cannot be fetched', () => {
      let provider: DeploymentManifestReference;

      beforeEach(async () => {
        const host = await aReferenceTo(hostArtifact);
        const app = await aReferenceTo(appArtifact);
        provider = await aReferenceTo(providerArtifact);

        await driver.given
          .deployment(
            aDeploymentWith({ host, apps: [app], widgetProviders: [provider] }),
          )
          .given.artifactAt(host.url!, hostArtifact)
          .given.artifactAt(app.url!, appArtifact)
          .when.loaded();
      });

      it('should return the catalog without the missing widget provider when loaded', () => {
        expect(driver.get.catalog()).toMatchObject({
          apps: [{ id: appArtifact.id }],
          widgetProviders: [],
        });
      });

      it('should log the skipped widget provider reference when loaded', () => {
        expect(driver.get.logErrorMock()).toHaveBeenCalledWith(
          `Atlas skipped "${provider.path}" because its manifest could not be loaded. The rest of the host still loads.`,
          expect.any(Error),
        );
      });
    });

    describe('when an app reference points to a host artifact', () => {
      let stray: DeploymentManifestReference;
      let strayArtifact: AtlasHostArtifactManifest;

      beforeEach(async () => {
        const host = await aReferenceTo(hostArtifact);
        strayArtifact = aHostArtifactManifest();
        stray = await aReferenceTo(strayArtifact);

        await driver.given
          .deployment(aDeploymentWith({ host, apps: [stray] }))
          .given.artifactAt(host.url!, hostArtifact)
          .given.artifactAt(stray.url!, strayArtifact)
          .when.loaded();
      });

      it('should return the catalog without the host artifact in apps when loaded', () => {
        expect(driver.get.catalog()).toMatchObject({ apps: [] });
      });

      it('should log the skipped reference when loaded', () => {
        expect(driver.get.logErrorMock()).toHaveBeenCalledWith(
          `Atlas skipped "${stray.path}" because it is a host artifact, not an app. The rest of the host still loads.`,
          expect.objectContaining({ kind: 'host', id: strayArtifact.id }),
        );
      });
    });

    it('should reject with ATLAS_INVALID_RUNTIME_CONFIG when a reference has no url and no artifactRegistryUrl is given', async () => {
      const host = await aReferenceTo(hostArtifact, { url: undefined });
      await driver.given.deployment(aDeploymentWith({ host })).when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_INVALID_RUNTIME_CONFIG',
        message: expect.stringContaining(
          `references "${host.path}" without a url`,
        ),
      });
    });

    it('should reject with ATLAS_INVALID_RUNTIME_CONFIG when the deployment hostId differs from expectedHostId', async () => {
      const host = await aReferenceTo(hostArtifact);
      const deployment = aDeploymentWith({ host });
      await driver.given
        .expectedHostId(faker.string.uuid())
        .given.deployment(deployment)
        .when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_INVALID_RUNTIME_CONFIG',
        message: expect.stringContaining(`selects host "${deployment.hostId}"`),
      });
    });

    it('should reject with ATLAS_INVALID_RUNTIME_CONFIG when the deployment environment differs from expectedEnvironment', async () => {
      const host = await aReferenceTo(hostArtifact);
      const deployment = aDeploymentWith({ host });
      await driver.given
        .expectedEnvironment(faker.word.noun())
        .given.deployment(deployment)
        .when.loaded();

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_INVALID_RUNTIME_CONFIG',
        message: expect.stringContaining(
          `in environment "${deployment.environment}"`,
        ),
      });
    });

    it('should reject with the byte sizes when a manifest size differs from its descriptor', async () => {
      const host = await aReferenceTo(hostArtifact, { size: 1 });
      await driver.given
        .deployment(aDeploymentWith({ host }))
        .given.artifactAt(host.url!, hostArtifact)
        .when.loaded();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `"${host.path}" has an unexpected byte size: expected 1 bytes`,
        ),
      });
    });

    it('should reject when a manifest digest differs from its descriptor', async () => {
      const host = await aReferenceTo(hostArtifact, {
        digest: aManifestDescriptor().digest,
      });
      await driver.given
        .deployment(aDeploymentWith({ host }))
        .given.artifactAt(host.url!, hostArtifact)
        .when.loaded();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining(
          `"${host.path}" failed SHA-256 verification`,
        ),
      });
    });

    it('should reject when the first reference is not a host artifact', async () => {
      const host = await aReferenceTo(appArtifact);
      await driver.given
        .deployment(aDeploymentWith({ host }))
        .given.artifactAt(host.url!, appArtifact)
        .when.loaded();

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining('does not select a host artifact'),
      });
    });
  });

  it('should include the JSON parse error when the deployment body is not JSON', async () => {
    await driver.given.deploymentText('{nope').when.loaded();

    expect(driver.get.error()).toMatchObject({
      message: expect.stringMatching(/invalid JSON from ".*": .+/u),
    });
  });

  it('should include the validation detail when the deployment shape is invalid', async () => {
    await driver.given
      .deploymentText(JSON.stringify({ kind: 'nope' }))
      .when.loaded();

    expect(driver.get.error()).toMatchObject({
      message: expect.stringMatching(
        /host deployment manifest at ".*" is invalid: .+/u,
      ),
    });
  });

  it('should keep the validation error as cause when the deployment shape is invalid', async () => {
    await driver.given
      .deploymentText(JSON.stringify({ kind: 'nope' }))
      .when.loaded();

    expect(driver.get.error()).toMatchObject({ cause: expect.any(Error) });
  });
});
