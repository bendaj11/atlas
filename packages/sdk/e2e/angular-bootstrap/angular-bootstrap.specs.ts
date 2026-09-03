import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AngularBootstrapDriver } from './angular-bootstrap.driver.js';

describe('Angular app bootstrap and provider configuration', () => {
  let driver: AngularBootstrapDriver;

  beforeEach(() => {
    driver = new AngularBootstrapDriver();
  });

  afterEach(() => {
    driver.when.cleanup();
  });

  it('should configure the provider with the app base URL when bootstrap runs before injection', async () => {
    await driver.when.mount(
      'https://cdn.example/apps/orders/1.2.3/remoteEntry.json',
    );

    expect(driver.get.configuredBaseUrls()).toEqual([
      'https://cdn.example/apps/orders/1.2.3/',
    ]);
  });

  it('should configure the provider with a local asset URL when the app is overridden', async () => {
    await driver.when.mount('http://localhost:4201/remoteEntry.json');

    expect(driver.get.configuredLogoUrls()).toEqual([
      'http://localhost:4201/images/logo.svg',
    ]);
  });

  it('should retain separate asset bases when two apps share a host SDK', async () => {
    await driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json');
    await driver.when.mount(
      'https://cdn.example/apps/reports/remoteEntry.json',
    );

    expect(driver.get.configuredBaseUrls()).toEqual([
      'https://cdn.example/apps/orders/',
      'https://cdn.example/apps/reports/',
    ]);
  });

  it('should preserve SDK identity when configuring asset providers', async () => {
    await driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json');

    expect(driver.get.bootstrapSdk()).toBe(driver.get.hostSdk());
  });

  it('should preserve copied SDK properties when configuring asset providers', async () => {
    await driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json');

    expect(driver.get.copiedSdk()).toEqual(driver.get.hostSdk());
  });

  it('should update every app signal when the host changes shared data after bootstrap', async () => {
    await driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json');
    await driver.when.mount(
      'https://cdn.example/apps/reports/remoteEntry.json',
    );

    driver.when.updateHostData('updated');

    expect(driver.get.userNames()).toEqual(['updated', 'updated']);
  });

  it('should propagate rejection when app bootstrap fails', async () => {
    driver.given.bootstrapFailure('Provider configuration failed');

    await expect(
      driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json'),
    ).rejects.toThrow('Provider configuration failed');
  });
});
