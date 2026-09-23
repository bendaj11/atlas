import { PublishServiceDriver } from './publish.service.driver.js';

describe('AtlasPublishService', () => {
  let driver: PublishServiceDriver;

  beforeEach(() => {
    driver = new PublishServiceDriver();
  });

  it('should publish manifest and payload when build output exists', async () => {
    await driver.when.publish();

    expect(driver.get.paths()).toHaveLength(3);
  });

  it('should not reconcile an uncertain immutable upload even when matching bytes were committed', async () => {
    driver.given.unknownWriteOutcome('create');

    await expect(driver.when.publish()).rejects.toMatchObject({
      publicationOutcomeUnknown: true,
    });
  });

  it('should stop publication retries when a registry write has an unknown outcome', async () => {
    driver.given.unknownWriteOutcome('replace');

    await driver.when.publish().catch(() => undefined);

    expect(driver.get.publicationAttempts()).toBe(1);
  });

  it('should verify refreshed delivery when publication writes have committed', async () => {
    driver.given.deliveryCache('none');

    await driver.when.publish();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'verify',
      'invalidate',
      'verify',
    ]);
  });

  it('should recover publication when cache refresh failed after the registry commit', async () => {
    driver.given.deliveryCache('invalidate-once');
    await driver.when.publish().catch(() => undefined);

    await driver.when.publish();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'verify',
      'invalidate',
      'invalidate',
      'verify',
      'invalidate',
      'verify',
    ]);
  });

  it('should retry delivery verification when a previous publication committed but delivery failed', async () => {
    driver.given.deliveryCache('verify-once');
    await driver.when.publish().catch(() => undefined);

    await driver.when.publish();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'verify',
      'invalidate',
      'verify',
      'invalidate',
      'verify',
      'invalidate',
      'verify',
    ]);
  });

  it('should report failure when browser delivery verification rejects', async () => {
    driver.given.deliveryCache('verify-once');

    await expect(driver.when.publish()).rejects.toThrow('Delivery unavailable');
  });

  it('should not register a release when immutable payload delivery fails', async () => {
    driver.given.deliveryCache('artifact-verify-once');

    await driver.when.publish().catch(() => undefined);

    expect(driver.get.registryExists()).toBe(false);
  });

  it('should skip cache mutation and delivery checks when publication is a dry run', async () => {
    driver.given.deliveryCache('none');
    driver.given.dryRun();

    await driver.when.publish();

    expect(driver.get.deliveryEvents()).toEqual([]);
  });

  it('should verify refreshed registry when removing a preview', async () => {
    driver.given.previewPruning();
    driver.given.deliveryCache('none');

    await driver.when.removePreview();

    expect(driver.get.deliveryEvents()).toEqual(['invalidate', 'verify']);
  });

  it('should recover delivery when preview removal already committed before invalidation failed', async () => {
    driver.given.previewPruning();
    driver.given.deliveryCache('invalidate-once');
    await driver.when.removePreview().catch(() => undefined);

    await driver.when.removePreview();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'invalidate',
      'verify',
    ]);
  });

  it('should verify refreshed registry when pruning previews', async () => {
    driver.given.previewPruning();
    driver.given.deliveryCache('none');

    await driver.when.prune();

    expect(driver.get.deliveryEvents()).toEqual(['invalidate', 'verify']);
  });

  it('should recover delivery when preview pruning committed before invalidation failed', async () => {
    driver.given.previewPruning();
    driver.given.deliveryCache('invalidate-once');
    await driver.when.prune().catch(() => undefined);

    await driver.when.prune();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'invalidate',
      'verify',
    ]);
  });

  it('should report publication stages when publishing a release', async () => {
    await driver.when.publish();

    expect(driver.get.progress()).toStrictEqual([
      'Building ' + driver.get.name() + '...',
      'Prepared ' + driver.get.identity() + '; 2 immutable file(s) ready.',
      'Waiting to acquire publication lock...',
      'Checking current registry revision...',
      'Uploading 2 immutable file(s) to publication storage...',
      'Verifying 2 uploaded immutable file(s) and metadata...',
      'Reading latest registry.json...',
      'Updating registry.json and configured caches...',
      'Verifying published registry...',
    ]);
  });

  it('should report dry-run validation when publishing without writes', async () => {
    driver.given.dryRun();
    await driver.when.publish();

    expect(driver.get.progress()).toStrictEqual([
      'Building ' + driver.get.name() + '...',
      'Prepared ' + driver.get.identity() + '; 2 immutable file(s) ready.',
      'Reading registry.json for dry-run validation...',
    ]);
  });

  describe('when registry verification is transiently unavailable', () => {
    beforeEach(async () => {
      driver.given.transientVerificationFailure();

      await driver.when.publish();
    });

    it('should report the retry when publication completes', () => {
      expect(driver.get.progress()).toContainEqual(
        expect.stringMatching(/retrying attempt 2 in \d+ms/),
      );
    });

    it('should build the project once when publication completes', () => {
      expect(driver.get.publicationAttempts()).toBe(1);
    });
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

  it('should recheck live preview head when committing registry mutation', async () => {
    driver.given.preview();

    await driver.when.publish();

    expect(driver.get.resolverMock()).toHaveBeenCalledTimes(2);
  });

  it('should prune only declared artifact selections when reconciling preview state', async () => {
    driver.given.previewPruning();

    await driver.when.prune();

    expect(driver.get.prunedSelections()).toStrictEqual({
      scoped: ['1'],
      unscoped: ['2'],
    });
  });

  it('should retry preview pruning when registry invalidation is transiently unavailable', async () => {
    driver.given.previewPruning();
    driver.given.transientInvalidationFailure();

    await driver.when.prune();

    expect(driver.get.pruneRetry()).toStrictEqual({
      removed: 1,
      invalidations: 2,
    });
  });

  it('should preserve preview removal result when invalidation retry observes applied state', async () => {
    driver.given.previewPruning();
    driver.given.transientInvalidationFailure();

    await driver.when.removePreview();

    expect(driver.get.removalRetry()).toStrictEqual({
      removed: true,
      invalidations: 2,
    });
  });

  it('should prune only declared artifact orphan generations when reconciling preview state', async () => {
    driver.given.previewPruning();

    await driver.when.prune();

    expect(driver.get.prunedOrphans()).toStrictEqual({
      removedGenerations: 1,
      scopedExists: false,
      unscopedExists: true,
    });
  });
});
