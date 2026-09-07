/** @jest-environment <rootDir>/packages/sdk/node_modules/jest-environment-jsdom */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ReactHostDriver } from './react-host.driver.js';

describe('React host SDK access', () => {
  let driver: ReactHostDriver;

  beforeEach(() => {
    driver = new ReactHostDriver();
  });
  afterEach(() => driver.when.cleanup());

  it('should expose the provided SDK when useAtlasSdk runs in a host without app context', () => {
    driver.when.renderHost();

    expect(driver.get.renderedHostId()).toBe(driver.get.hostId());
  });

  it('should expose custom SDK methods when useAtlasSdk runs in a host without app context', async () => {
    driver.when.renderHost();
    await driver.when.sendMessage();

    expect(driver.get.messageHandler()).toHaveBeenCalledWith(
      driver.get.message(),
    );
  });

  it('should update host consumers when shared data changes', async () => {
    driver.when.renderHost();
    await driver.when.updateHostData();

    expect(await driver.get.updatedHostName()).toBe(driver.get.updatedName());
  });

  it('should explain missing app context when the host requests an asset base', async () => {
    driver.when.renderHost();
    await driver.when.readAssetBase();

    expect(driver.get.assetResult()).toContain(
      'App asset URLs require an Atlas app context.',
    );
  });

  it('should explain missing app context when the host requests an asset URL', async () => {
    driver.when.renderHost();
    await driver.when.readAssetUrl();

    expect(driver.get.assetResult()).toContain(
      'App asset URLs require an Atlas app context.',
    );
  });

  it('should resolve asset URLs when a mounted app provides its context', async () => {
    driver.when.renderApp('https://cdn.example/apps/orders/remoteEntry.json');
    await driver.when.readAssetUrl();

    expect(driver.get.assetResult()).toBe(
      'https://cdn.example/apps/orders/logo.svg',
    );
  });
});
