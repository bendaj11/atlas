import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ControlServerDriver } from './control-server.driver.js';

describe('development control server', () => {
  let driver: ControlServerDriver;

  beforeEach(() => {
    driver = new ControlServerDriver();
  });

  afterEach(async () => {
    await driver.when.close();
  });

  it('should restore a running app when host control server restarts', async () => {
    await driver.given.runningHostAndApp();

    await driver.when.restartHostAndReconcileApp();

    expect(await driver.get.catalogAppIds()).toStrictEqual(driver.get.appIds());
  });

  it('should retain app session when control server owner stops', async () => {
    await driver.given.runningHostAndApp();

    await driver.when.ownerStoppedAndAppReconciled();

    expect(await driver.get.catalogAppIds()).toStrictEqual(driver.get.appIds());
  });

  it('should restore local host and app when local host restarts', async () => {
    await driver.given.runningHostAndApp();

    await driver.when.localHostRestartedAfterAppRecovered();

    expect(await driver.get.localHostAndAppState()).toStrictEqual(
      driver.get.recoveredLocalHostAndAppState(),
    );
  });

  it('should restore local app when local host restarts before app recovery', async () => {
    await driver.given.runningHostAndApp();

    await driver.when.localHostRestartedBeforeAppRecovers();

    expect(await driver.get.localHostAndAppState()).toStrictEqual(
      driver.get.recoveredLocalHostAndAppState(),
    );
  });

  it('should restore both apps when control server owner restarts', async () => {
    await driver.given.runningApps();

    await driver.when.ownerAppRestartedAfterAppRecovered();

    expect(await driver.get.catalogAppIds()).toStrictEqual(
      driver.get.allAppIds(),
    );
  });

  it('should restore both apps when owner restarts before app recovery', async () => {
    await driver.given.runningApps();

    await driver.when.ownerAppRestartedBeforeAppRecovers();

    expect(await driver.get.catalogAppIds()).toStrictEqual(
      driver.get.allAppIds(),
    );
  });

  it('should retain published apps when local host is served from a registry', async () => {
    await driver.given.runningHostAndAppWithPublishedRegistry();

    expect(await driver.get.catalogAppIds()).toStrictEqual(
      driver.get.publishedCatalogAppIds(),
    );
  });

  it('should not expose alternate registry schema when development server runs', async () => {
    await driver.given.runningHostAndApp();

    expect(await driver.get.registryStatus()).toBe(404);
  });

  it('should serve extension activation without exposing control parameters to preview', async () => {
    await driver.given.runningHostAndApp();

    const page = await driver.get.activationPage();

    expect({
      hasControlParameter: page.body.includes('atlas-dev-port'),
      hasInstallGuidance: page.body.includes('Columbus must be installed'),
      referrerPolicy: page.referrerPolicy,
      status: page.status,
    }).toStrictEqual({
      hasControlParameter: false,
      hasInstallGuidance: true,
      referrerPolicy: 'no-referrer',
      status: 200,
    });
  });

  it('should reject activation when capability is replayed', async () => {
    await driver.given.runningHostAndApp();
    await driver.get.activationPage();
    await driver.when.consumeActivation();

    expect(await driver.get.replayedActivationStatus()).toBe(410);
  });

  it('should return capability-bound target and development session when activation is consumed', async () => {
    await driver.given.runningHostAndApp();
    await driver.get.activationPage();
    await driver.when.consumeActivation();

    expect(driver.get.consumedActivation()).toMatchObject({
      body: {
        protocolVersion: '1',
        targetUrl: 'https://preview.example/orders',
        document: { hostId: driver.get.hostId(), schemaVersion: '1' },
      },
      status: 200,
    });
  });
});
