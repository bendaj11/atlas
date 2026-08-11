import { beforeEach, describe, expect, it } from '@jest/globals';
import { CliErrorDriver } from './cli-error.driver.js';

describe('createCliError', () => {
  let driver: CliErrorDriver;

  beforeEach(() => {
    driver = new CliErrorDriver();
  });

  it('should retain summary when command is unknown', () => {
    driver.given.error('unknown');

    expect(driver.get.error().summary).toBe(driver.get.unknownSummary());
  });

  it('should suggest command help when command is unknown', () => {
    driver.given.error('unknown');

    expect(driver.get.error().suggestedActions).toStrictEqual([
      'Run `atlas --help` to choose a supported command, then retry with the documented arguments.',
    ]);
  });

  it('should prefix error when build fails', () => {
    driver.given.error('build');

    expect(driver.get.error().summary).toBe(
      'Atlas build failed: spawn vite ENOENT',
    );
  });

  it('should suggest recovery when build input is missing', () => {
    driver.given.error('build');

    expect(driver.get.error().suggestedActions).toStrictEqual([
      'Restore the named file or pass an existing Atlas project or path.',
      'Rerun `atlas build` after correcting the condition.',
    ]);
  });

  it('should preserve cause when wrapping build error', () => {
    driver.given.error('build');

    expect(driver.get.error().cause).toBe(driver.get.cause());
  });

  it('should suggest storage recovery when publication storage fails', () => {
    driver.given.error('publish');

    expect(driver.get.error().suggestedActions[0]).toMatch(
      /storage, registry, credentials, or deployment-lock/,
    );
  });

  it('should suggest retry when publication storage fails', () => {
    driver.given.error('publish');

    expect(driver.get.error().suggestedActions[1]).toBe(
      'Rerun `atlas publish` after correcting the condition.',
    );
  });

  it('should include storage cause when publication storage fails', () => {
    driver.given.error('storage');

    expect(driver.get.formattedError()).toContain(
      'Caused by: Error: AccessDenied',
    );
  });

  it('should set CLI surface when wrapping browser error', () => {
    driver.given.error('browser');

    expect(driver.get.error().surface).toBe('cli');
  });

  it('should remove browser recovery when wrapping browser error', () => {
    driver.given.error('browser');

    expect(driver.get.error().message).not.toMatch(/reload this page/);
  });

  it('should add CLI recovery when wrapping browser error', () => {
    driver.given.error('browser');

    expect(driver.get.error().message).toMatch(/rerun `atlas verify`/);
  });
});
