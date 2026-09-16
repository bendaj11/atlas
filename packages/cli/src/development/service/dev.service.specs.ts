import { faker } from '@faker-js/faker';
import type { AtlasConfig, AtlasHostManifest } from '@atlas/schema';
import { createTestManifest } from '@atlas/testkit';
import { DevServiceDriver } from './dev.service.driver.js';

function aHostConfig(id: string): AtlasConfig {
  return { id, framework: 'react', type: 'host' } as AtlasConfig;
}

function aLocalHostManifest(id: string): AtlasHostManifest {
  return {
    schemaVersion: '1',
    kind: 'host',
    id,
    name: faker.company.name(),
    version: '1.0.0',
    buildId: 'local',
    channel: 'local',
    framework: 'react',
    remoteEntryUrl: 'http://localhost:4300/remoteEntry.json',
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    createdAt: faker.date.past().toISOString(),
  };
}

describe('AtlasDevService', () => {
  let driver: DevServiceDriver;

  beforeEach(async () => {
    driver = new DevServiceDriver();

    await driver.given.project();
  });

  it('should reject --host-url when development starts', async () => {
    driver.given
      .config(aHostConfig(faker.string.uuid()))
      .given.flags([`--host-url=${faker.internet.url()}`]);

    await expect(driver.when.run()).rejects.toThrow(
      '--host-url is not supported by atlas dev. Define package.json atlas.previews instead.',
    );
  });

  describe('when a host has no previews and --prepare-only is set', () => {
    const hostId = faker.string.uuid();

    beforeEach(async () => {
      driver.given
        .config(aHostConfig(hostId))
        .given.hostManifest(aLocalHostManifest(hostId));

      await driver.when.run();
    });

    it('should write the host override document when prepared', async () => {
      expect(await driver.get.overrideDocument()).toMatchObject({
        hostId,
        hostOverride: { id: hostId },
        overrides: [],
      });
    });

    it('should target the local bootstrap origin when prepared', async () => {
      expect((await driver.get.overrideDocument()).previewUrl).toBe(
        'http://localhost:4200',
      );
    });

    it('should not spawn a framework server when prepared', () => {
      expect(driver.get.spawnMock()).not.toHaveBeenCalled();
    });
  });

  it('should target the package preview when a deployed host preview is configured', async () => {
    const hostId = faker.string.uuid();
    const previewUrl = `https://${faker.internet.domainName()}`;
    driver.given
      .config(aHostConfig(hostId))
      .given.hostManifest(aLocalHostManifest(hostId))
      .given.deployedHost(hostId)
      .given.flags(['--port=4500']);
    await driver.given.previews([previewUrl]);

    await driver.when.run();

    expect((await driver.get.overrideDocument()).previewUrl).toBe(previewUrl);
  });

  it('should reject a local host preview whose port differs from the bootstrap port', async () => {
    const hostId = faker.string.uuid();
    driver.given
      .config(aHostConfig(hostId))
      .given.hostManifest(aLocalHostManifest(hostId))
      .given.flags(['--port=4500']);
    await driver.given.previews(['http://localhost:4999']);

    await expect(driver.when.run()).rejects.toThrow(
      /must use http and configured bootstrap port 4500/,
    );
  });

  describe('when an app has a preview and --prepare-only is set', () => {
    const appId = faker.string.uuid();
    const hostId = faker.string.uuid();
    const previewUrl = `https://${faker.internet.domainName()}`;
    const manifest = createTestManifest({
      id: appId,
      channel: 'local',
      buildId: 'local',
      remoteEntryUrl: 'http://localhost:4500/remoteEntry.json',
    });

    beforeEach(async () => {
      driver.given
        .config({
          id: appId,
          framework: 'react',
          routes: [{ hostId: '*', path: '/orders' }],
        } as AtlasConfig)
        .given.appManifest(manifest)
        .given.deployedHost(hostId)
        .given.flags(['--port=4500']);
      await driver.given.previews([previewUrl]);

      await driver.when.run();
    });

    it('should write the app override targeting the discovered host and route when prepared', async () => {
      expect(await driver.get.overrideDocument()).toMatchObject({
        hostId,
        previewUrl: `${previewUrl}/orders`,
        overrides: [{ appId, reason: 'local', manifest: { id: appId } }],
      });
    });

    it('should not spawn a framework server when prepared', () => {
      expect(driver.get.spawnMock()).not.toHaveBeenCalled();
    });
  });
});
