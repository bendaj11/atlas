import { beforeEach, describe, expect, it } from '@jest/globals';
import { PublishServiceDriver } from './publish.service.driver.js';

describe('AtlasPublishService', () => {
  let driver: PublishServiceDriver;

  beforeEach(() => {
    driver = new PublishServiceDriver();
  });

  it('should upload immutable files before mutable metadata when publication succeeds', async () => {
    await driver.given.publication('publish');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      entry: 'export {};\n',
      uploaded: [
        'apps/{appId}/1.0.0/build-1/app.manifest.json',
        'apps/{appId}/1.0.0/build-1/atlas-publication.json',
        'apps/{appId}/1.0.0/build-1/entry.js',
        'registry.json',
        'apps/{appId}/index.json',
      ],
    });
  });

  it('should reject publication when writable storage is missing', async () => {
    await driver.given.publication('missing-storage');

    await expect(driver.when.run()).rejects.toThrow(
      /Publication storage is required/,
    );
  });

  it('should complete without storage when publication is dry run', async () => {
    await driver.given.publication('dry-run');

    await driver.when.run();

    expect(driver.get.observation()).toBe(true);
  });

  it('should reject publication when deployment verification fails', async () => {
    await driver.given.publication('verification-failure');

    await expect(driver.when.run()).rejects.toThrow(/smoke test failed/);
  });

  it('should restore publication state when deployment verification fails', async () => {
    await driver.given.publication('verification-cleanup');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      immutableExists: false,
      registryRestored: true,
    });
  });

  it('should invalidate CDN before verification when publication succeeds', async () => {
    await driver.given.publication('sequencing');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual([
      'invalidate:registry.json,apps/{appId}/index.json',
      'verify',
    ]);
  });

  it('should reject publication when mutable write fails', async () => {
    await driver.given.publication('mutable-failure');

    await expect(driver.when.run()).rejects.toThrow(/simulated write failure/);
  });

  it('should restore earlier writes when mutable write fails', async () => {
    await driver.given.publication('mutable-cleanup');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      index: undefined,
      registryRestored: true,
    });
  });

  it('should select stored production build when rollback is requested', async () => {
    await driver.given.publication('rollback');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      buildId: 'stable',
      selection: { buildId: 'stable', version: '1.0.0' },
    });
  });

  it('should reject publication when deployment lease is lost', async () => {
    await driver.given.publication('lease-loss');

    await expect(driver.when.run()).rejects.toThrow(
      /lost its deployment lease/,
    );
  });

  it('should avoid mutable activation when deployment lease is lost', async () => {
    await driver.given.publication('lease-cleanup');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      indexExists: false,
      registryExists: false,
    });
  });

  it('should skip PR build when provider head moves', async () => {
    await driver.given.publication('moved-head');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      registryExists: false,
      skipped: true,
    });
  });

  it('should retain only latest successful build when artifact and PR match', async () => {
    await driver.given.publication('latest-pr');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      buildIds: ['second'],
      cleanupWarnings: [],
      firstExists: false,
      secondExists: true,
    });
  });

  it('should remove matching artifacts when PR is removed', async () => {
    await driver.given.publication('remove-pr');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      artifactExists: false,
      registryApps: [],
      removedBuilds: 1,
    });
  });

  it('should preserve open PR then remove missing PR when state is authoritative', async () => {
    await driver.given.publication('prune-pr');

    await driver.when.run();

    expect(driver.get.observation()).toStrictEqual({
      preserved: 0,
      removed: 1,
    });
  });
});
