import { beforeEach, describe, expect, it } from '@jest/globals';
import { DevelopmentProcessDriver } from './process.driver.js';

describe('remoteEntryIsReady', () => {
  let driver: DevelopmentProcessDriver;

  beforeEach(() => {
    driver = new DevelopmentProcessDriver();
  });

  it('should return false when response contains HTML', async () => {
    driver.given.response('html');

    await driver.when.check();

    expect(driver.get.readiness()).toBe(false);
  });

  it('should return false when response is unsuccessful', async () => {
    driver.given.response('missing');

    await driver.when.check();

    expect(driver.get.readiness()).toBe(false);
  });

  it('should return true when response contains federation metadata', async () => {
    driver.given.response('metadata');

    await driver.when.check();

    expect(driver.get.readiness()).toBe(true);
  });

  it('should select open command when platform is macOS', () => {
    driver.when.buildBrowserCommand('darwin');

    expect(driver.get.value()).toStrictEqual({
      args: ['{url}'],
      command: 'open',
    });
  });

  it('should select xdg-open command when platform is Linux', () => {
    driver.when.buildBrowserCommand('linux');

    expect(driver.get.value()).toStrictEqual({
      args: ['{url}'],
      command: 'xdg-open',
    });
  });

  it('should select start command when platform is Windows', () => {
    driver.when.buildBrowserCommand('win32');

    expect(driver.get.value()).toStrictEqual({
      args: ['/c', 'start', '', '{url}'],
      command: 'cmd',
    });
  });

  it('should include localhost when React server arguments are resolved', () => {
    driver.when.resolveServerArguments('react', 4200);

    expect(driver.get.value()).toStrictEqual([
      '--port',
      '4200',
      '--host',
      'localhost',
    ]);
  });

  it('should omit host when Angular server arguments are resolved', () => {
    driver.when.resolveServerArguments('angular', 4201);

    expect(driver.get.value()).toStrictEqual(['--port', '4201']);
  });

  it('should include captured output when framework failure is formatted', () => {
    driver.when.formatFailure();

    const value = driver.get.value<{
      error: string;
      message: string;
      output: string;
    }>();

    expect(value.error).toBe(
      `${value.message}\n\nFramework server output:\n${value.output}`,
    );
  });

  it('should add default control port when production host is activated', () => {
    driver.when.activateHostUrl('https://host.example/orders', 4400);

    expect(driver.get.value()).toBe(
      'https://host.example/orders?atlas-dev-port=4400',
    );
  });
});
