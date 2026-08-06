import { beforeEach, describe, expect, it } from '@jest/globals';
import { EntrypointDriver } from './entrypoint.driver.js';

describe('CLI entrypoint', () => {
  let driver: EntrypointDriver;

  beforeEach(() => {
    driver = new EntrypointDriver();
  });

  it('should print package version when version is requested', async () => {
    await driver.when.run('version');

    expect(driver.get.version()).toStrictEqual({
      code: 0,
      stderr: '',
      stdout: `${await driver.get.packageVersion()}\n`,
    });
  });

  it('should print concise catalog when root help is requested', async () => {
    await driver.when.run('root-help');

    expect(driver.get.rootHelp()).toStrictEqual({
      code: 0,
      hasCommandCatalog: true,
      hasNoColor: true,
      hasNoInput: true,
      hasRegistryOption: false,
    });
  });

  it('should describe command details when build help is requested', async () => {
    await driver.when.run('build-help');

    expect(driver.get.buildHelp()).toStrictEqual({
      code: 0,
      hasArguments: true,
      hasEnvironment: true,
      hasExamples: true,
      hasRegistryOption: true,
      hasUsage: true,
    });
  });

  it('should resolve command aliases when alias help is requested', async () => {
    await driver.when.run('alias-help');

    expect(driver.get.generationHelp()).toMatchObject({
      code: 0,
      hasFrameworkOption: true,
    });
  });

  it('should show widget help when resource name is missing', async () => {
    await driver.when.run('widget-help');

    expect(driver.get.generationHelp()).toMatchObject({
      code: 0,
      hasAppOption: true,
      hasWidgetUsage: true,
    });
  });

  it('should document installation control when host help is requested', async () => {
    await driver.when.run('host-help');

    expect(driver.get.generationHelp()).toMatchObject({
      code: 0,
      hasDirectoryOption: true,
      hasSkipInstallOption: true,
    });
  });

  it('should accept only explicit host ID when app help is requested', async () => {
    await driver.when.run('app-help');

    expect(driver.get.appHelp()).toStrictEqual({
      code: 0,
      hasHostFlag: false,
      hasHostIdFlag: true,
    });
  });

  it('should ignore positional value when command help is requested', async () => {
    await driver.when.run('positional-help');

    expect(driver.get.buildHelp()).toMatchObject({ code: 0, hasUsage: true });
  });

  it('should explain error when command is unknown', async () => {
    await driver.when.run('unknown-command');

    expect(driver.get.stderr()).toMatch(/^✖ Unknown or incomplete command/);
  });

  it('should require app when widget generation is non-interactive', async () => {
    await driver.when.run('unconfigured-widget');

    expect(driver.get.stderr()).toMatch(
      /--app-id <app-id> is required to generate a widget in non-interactive mode/,
    );
  });
});
