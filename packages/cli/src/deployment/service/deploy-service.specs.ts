import { DeployServiceDriver } from './deploy-service.driver.js';

describe('AtlasDeployService', () => {
  let driver: DeployServiceDriver;

  beforeEach(() => {
    driver = new DeployServiceDriver();
  });

  afterEach(() => {
    driver.when.cleanup();
  });

  it('should write selected version to environment state when exact release is deployed', async () => {
    await driver.given.catalog();
    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBe('1.4.0');
  });

  it('should generate descriptor-only active manifest when release is deployed', async () => {
    await driver.given.catalog();
    await driver.when.deploy();

    expect(driver.get.activeManifest().apps[0]).not.toHaveProperty('url');
  });

  it('should resolve latest from source artifact catalog when latest is selected', async () => {
    await driver.given.catalog();
    driver.given.latest();

    await driver.when.deploy();

    expect(driver.get.result()?.version).toBe('1.4.0');
  });

  it('should resolve selected source environment version when environment is selected', async () => {
    await driver.given.catalog();
    await driver.given.sourceEnvironment();

    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBe('1.4.0');
  });

  it('should not copy artifacts to target when source and target registries differ', async () => {
    await driver.given.catalog();
    await driver.given.separateRegistries();

    await driver.when.deploy();

    expect(driver.get.targetArtifactPaths()).toEqual([]);
  });

  it('should reject mixed registry shorthand and explicit flags when both are supplied', async () => {
    await driver.given.catalog();
    driver.given.conflictingFlags();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('cannot be combined'),
      }),
    );
  });

  it('should not invalidate registry paths when deployment is a dry run', async () => {
    await driver.given.catalog();
    driver.given.dryRun();

    await driver.when.deploy();

    expect(driver.get.invalidations()).toEqual([]);
  });

  it('should retry deployment when cache invalidation is transiently unavailable', async () => {
    await driver.given.catalog();
    driver.given.transientInvalidationFailure();

    await driver.when.deploy();

    expect(driver.get.invalidations()).toHaveLength(4);
  });

  it('should retain target environment selections when deployment is a dry run', async () => {
    await driver.given.catalog();
    driver.given.dryRun();

    await driver.when.deploy();

    expect(driver.get.selectedAppVersion()).toBeUndefined();
  });

  it('should reject malformed target environment state when deployment reads it', async () => {
    await driver.given.catalog();
    await driver.given.malformedTargetState();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('deployment state is invalid'),
      }),
    );
  });

  it('should reject insecure registry URL when registry is not loopback', async () => {
    await driver.given.catalog();
    driver.given.insecureRegistry();

    await expect(driver.get.deployError()).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('must use HTTPS'),
      }),
    );
  });

  it('should verify refreshed delivery when deployment writes have committed', async () => {
    await driver.given.catalog();
    driver.given.deliveryCache('none');

    await driver.when.deploy();

    expect(driver.get.deliveryEvents()).toEqual(['invalidate', 'verify']);
  });

  it('should recover deployment when cache refresh failed after committing state', async () => {
    await driver.given.catalog();
    driver.given.deliveryCache('invalidate-once');
    await driver.when.deploy().catch(() => undefined);

    await driver.when.deploy();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'invalidate',
      'verify',
    ]);
  });

  it('should recover delivery when deployment previously committed but verification failed', async () => {
    await driver.given.catalog();
    driver.given.deliveryCache('verify-once');
    await driver.when.deploy().catch(() => undefined);

    await driver.when.deploy();

    expect(driver.get.deliveryEvents()).toEqual([
      'invalidate',
      'verify',
      'invalidate',
      'verify',
    ]);
  });

  it('should reject deployment when delivery verification fails', async () => {
    await driver.given.catalog();
    driver.given.deliveryCache('verify-once');

    await expect(driver.when.deploy()).rejects.toThrow('Delivery unavailable');
  });

  it('should skip delivery side effects when deployment is a dry run', async () => {
    await driver.given.catalog();
    driver.given.deliveryCache('none');
    driver.given.dryRun();

    await driver.when.deploy();

    expect(driver.get.deliveryEvents()).toEqual([]);
  });
});
