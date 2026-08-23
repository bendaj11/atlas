import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PublishServiceDriver } from './publish.service.driver.js';

describe('AtlasPublishService', () => {
  let driver: PublishServiceDriver;

  beforeEach(() => {
    driver = new PublishServiceDriver();
  });

  afterEach(async () => {
    await driver.when.cleanup();
  });

  it('should publish manifest and payload when build output exists', async () => {
    await driver.when.publish();

    expect(driver.get.paths()).toHaveLength(3);
  });

  it('should keep registry entries as descriptors when release is published', async () => {
    await driver.when.publish();

    expect(JSON.stringify(driver.get.registry())).not.toContain('entryPath');
  });

  it('should remain idempotent when identical version is published twice', async () => {
    await driver.when.publish();

    await driver.when.publish();

    expect(driver.get.result()?.uploaded).toHaveLength(2);
  });

  it('should reject version collision when payload changes', async () => {
    await driver.when.publish();
    driver.given.changedBytes();

    await expect(driver.when.publish()).rejects.toThrow(/different digest/);
  });

  it('should expose one logical preview when preview is republished', async () => {
    driver.given.preview();
    await driver.when.publish();
    driver.given.changedBytes();

    await driver.when.publish();

    expect(
      Object.keys(Object.values(driver.get.registry().apps)[0]!.previews),
    ).toHaveLength(1);
  });

  it('should recheck live preview head before registry mutation', async () => {
    driver.given.preview();

    await driver.when.publish();

    expect(driver.get.resolverCalls()).toBe(2);
  });

  it('should prune selections only for artifacts declared by state', async () => {
    driver.given.previewPruning();

    await driver.when.prune();

    expect(driver.get.prunedSelections()).toStrictEqual({
      scoped: ['1'],
      unscoped: ['2'],
    });
  });

  it('should prune orphan generations only for artifacts declared by state', async () => {
    driver.given.previewPruning();

    await driver.when.prune();

    expect(driver.get.prunedOrphans()).toStrictEqual({
      removedGenerations: 1,
      scopedExists: false,
      unscopedExists: true,
    });
  });
});
