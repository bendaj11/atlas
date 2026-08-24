import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DeployServiceDriver } from './deploy.service.driver.js';

describe('AtlasDeployService', () => {
  let driver: DeployServiceDriver;

  beforeEach(async () => {
    driver = new DeployServiceDriver();
    await driver.given.registry();
  });

  afterEach(() => {
    driver.when.cleanup();
  });

  it('should activate one exact app release when deploy is requested', async () => {
    await driver.when.deploy();

    expect(driver.get.productionVersion()).toBe('1.4.0');
  });

  it('should write descriptor references when host converges', async () => {
    await driver.when.deploy();

    expect(JSON.stringify(driver.get.activeManifest())).not.toContain(
      'placements',
    );
  });

  it('should resolve latest when latest selector is requested', async () => {
    driver.given.latest();

    await driver.when.deploy();

    expect(driver.get.result()?.version).toBe('1.4.0');
  });

  it('should resolve a source environment when environment selector is requested', async () => {
    await driver.given.sourceEnvironment();

    await driver.when.deploy();

    expect(driver.get.productionVersion()).toBe('1.4.0');
  });

  it('should keep active manifests separate when environments share a registry', async () => {
    await driver.when.deploy();
    await driver.given.targetEnvironment('integration');

    await driver.when.deploy();

    expect(driver.get.activeEnvironments()).toEqual([
      'integration',
      'production',
    ]);
  });

  it('should stream exact release bytes when registries differ', async () => {
    await driver.given.crossRegistry();

    await driver.when.deploy();

    expect(driver.get.crossRegistryTransfer()).toStrictEqual(
      driver.get.expectedCrossRegistryTransfer(),
    );
  });

  it('should converge on retry when host projection initially fails', async () => {
    driver.given.projectionFailure();

    await driver.when.deploy();
    await driver.when.deploy();

    expect(driver.get.convergence()).toStrictEqual({
      firstPending: [driver.get.hostId()],
      firstFailed: true,
      desiredVersionAfterFirst: '1.4.0',
      activeAfterFirst: false,
      secondPending: [],
      activeVersion: '1.4.0',
    });
  });

  it('should perform no writes when deployment is a dry run', async () => {
    driver.given.dryRun();

    await driver.when.deploy();

    expect({
      dryRun: driver.get.result()?.dryRun,
      mutations: driver.get.mutationCount(),
    }).toStrictEqual({ dryRun: true, mutations: 0 });
  });

  it('should reject source redirects when registry copy starts', async () => {
    await driver.given.crossRegistry();
    driver.given.sourceRedirect();

    await expect(driver.when.deploy()).rejects.toThrow(/refuses redirects/);
  });

  it('should reject payload metadata when content type differs', async () => {
    await driver.given.crossRegistry();
    driver.given.invalidPayloadMetadata();

    await expect(driver.when.deploy()).rejects.toThrow(/Content-Type/);
  });

  it('should accept payload when optional content type parameters are absent', async () => {
    await driver.given.crossRegistry();
    driver.given.payloadWithoutOptionalCharset();

    await driver.when.deploy();

    expect(driver.get.productionVersion()).toBe('1.4.0');
  });

  it('should reject concurrent payload when stored metadata differs', async () => {
    await driver.given.crossRegistry();
    driver.given.concurrentPayloadWithInvalidMetadata();

    await expect(driver.when.deploy()).rejects.toThrow(
      /unexpected HTTP metadata/,
    );
  });

  it('should reject insecure target registry when host is not loopback', async () => {
    driver.given.insecureTarget();

    await expect(driver.when.deploy()).rejects.toThrow(/must use HTTPS/);
  });

  it('should reject a manifest whose identity differs from its selected artifact', async () => {
    await driver.given.crossRegistry();
    driver.given.mismatchedManifestIdentity();

    await expect(driver.when.deploy()).rejects.toThrow(
      /identity does not match registry selection/,
    );
  });

  it('should not update unrelated hosts when app targets one host', async () => {
    await driver.given.registryWithUnrelatedHost();

    await driver.when.deploy();

    expect(driver.get.unrelatedHostWasUpdated()).toBe(false);
  });

  it('should update every deployed host when app placement uses wildcard', async () => {
    await driver.given.registryWithWildcardPlacement();

    await driver.when.deploy();

    expect(driver.get.convergedHostIds()).toStrictEqual(
      [driver.get.hostId(), driver.get.unrelatedHostId()].sort(),
    );
  });

  it('should update previous host when next app release removes placement', async () => {
    await driver.given.previouslyDeployedApp();

    await driver.when.deploy();

    expect(driver.get.removedPlacementConvergence()).toStrictEqual({
      convergedHostIds: [driver.get.hostId()],
      activeAppCount: 0,
    });
  });

  it('should project dependency as widget provider when provider has no placement', async () => {
    await driver.given.widgetProvider();

    await driver.when.deploy();

    expect(driver.get.projectionKinds()).toStrictEqual({
      apps: 1,
      widgetProviders: 1,
    });
  });

  it('should require public URL when host is deployed for first time', async () => {
    driver.given.hostDeployment();

    await expect(driver.when.deploy()).rejects.toThrow(/--host-url/);
  });

  it('should write host discovery when host URL is provided', async () => {
    driver.given.hostDeployment(
      'https://customer.example.com/portal/',
      'https://partners.example.com/atlas/|production',
    );

    await driver.when.deploy();

    expect(driver.get.discovery()).toStrictEqual({
      schemaVersion: '1',
      hostId: driver.get.hostId(),
      bindings: [
        {
          baseUrl: 'https://customer.example.com/portal',
          environment: 'production',
          manifestUrl: `http://localhost:4400/environments/production/hosts/${driver.get.hostId()}/manifest.json`,
          externalRegistries: [
            {
              registryUrl: 'https://partners.example.com/atlas',
              environment: 'production',
            },
          ],
        },
      ],
    });
  });
});
