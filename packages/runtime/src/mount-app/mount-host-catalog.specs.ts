/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import {
  aHostArtifactManifest,
  anAppArtifactManifest,
} from '@atlas/testkit/internal';
import {
  aDeploymentWith,
  aReferenceTo,
} from '../loader/deployment/deployment.testkit.js';
import { MountHostCatalogDriver } from './mount-host-catalog.driver.js';

describe('loadAndMountHostCatalog', () => {
  let driver: MountHostCatalogDriver;

  beforeEach(() => {
    driver = new MountHostCatalogDriver();
  });

  describe('when the deployment selects two apps that support every host', () => {
    const hostArtifact = aHostArtifactManifest();
    const first = anAppArtifactManifest({ supportedHosts: ['*'] });
    const second = anAppArtifactManifest({ supportedHosts: ['*'] });

    beforeEach(async () => {
      const host = await aReferenceTo(hostArtifact);
      const firstReference = await aReferenceTo(first);
      const secondReference = await aReferenceTo(second);
      driver.given
        .deployment(
          aDeploymentWith({
            host,
            apps: [firstReference, secondReference],
            overrides: { hostId: driver.hostId },
          }),
        )
        .given.artifactAt(host.url!, hostArtifact)
        .given.artifactAt(firstReference.url!, first)
        .given.artifactAt(secondReference.url!, second);
    });

    it('should mount every app that has a container when mounted', async () => {
      driver.given.containerFor(first.id).given.containerFor(second.id);

      await driver.when.mounted();

      expect(driver.get.mountedIds()).toEqual([first.id, second.id]);
    });

    it('should skip apps without a container when mounted', async () => {
      driver.given.containerFor(second.id);

      await driver.when.mounted();

      expect(driver.get.importRemoteMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should reject with ATLAS_INVALID_RUNTIME_CONFIG when the deployment belongs to another host', async () => {
    const hostArtifact = aHostArtifactManifest();
    const host = await aReferenceTo(hostArtifact);
    driver.given
      .deployment(
        aDeploymentWith({ host, overrides: { hostId: faker.string.uuid() } }),
      )
      .given.artifactAt(host.url!, hostArtifact);

    await driver.when.mounted();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_INVALID_RUNTIME_CONFIG',
    });
  });
});
