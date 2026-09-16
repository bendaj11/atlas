import { AngularBootstrapDriver } from './angular-bootstrap.driver.js';

describe('Angular host and app SDK integration', () => {
  let driver: AngularBootstrapDriver;

  beforeEach(() => {
    driver = new AngularBootstrapDriver();
  });

  afterEach(() => driver.when.cleanup());

  it('should expose live host data when injected without app context', () => {
    driver.when.injectInHost();
    driver.when.updateHostData('updated');

    expect(driver.get.userNames()).toEqual(['updated']);
  });

  it('should expose the provided SDK when injectAtlasSdk runs in a host without app context', () => {
    driver.when.injectInHost();

    expect(driver.get.injectedHostId()).toBe(driver.get.hostId());
  });

  it('should expose custom SDK methods when injectAtlasSdk runs in a host without app context', () => {
    driver.when.injectInHost();
    driver.when.sendMessage();

    expect(driver.get.messageHandler()).toHaveBeenCalledWith(
      driver.get.message(),
    );
  });

  it('should explain missing app context when the host requests an app asset base', () => {
    driver.when.injectInHost();

    expect(() => driver.get.assetBaseUrl()).toThrow(
      'App asset URLs require an Atlas app context.',
    );
  });

  it('should explain missing app context when the host requests an app asset URL', () => {
    driver.when.injectInHost();

    expect(() => driver.get.assetUrl('logo.svg')).toThrow(
      'App asset URLs require an Atlas app context.',
    );
  });

  it('should resolve injected asset URLs when running inside an app', async () => {
    await driver.when.mount('https://cdn.example/apps/orders/remoteEntry.json');

    expect(driver.get.assetUrl('logo.svg')).toBe(
      'https://cdn.example/apps/orders/logo.svg',
    );
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
