import { faker } from '@faker-js/faker';
import { EntrypointDriver } from './entrypoint.driver.js';

describe('CLI entrypoint', () => {
  let driver: EntrypointDriver;

  beforeEach(() => {
    driver = new EntrypointDriver();
  });

  it('should print the package version when --version is given', async () => {
    await driver.when.run(['--version']);

    expect(driver.get.result()).toStrictEqual({
      code: 0,
      stderr: '',
      stdout: `${await driver.get.packageVersion()}\n`,
    });
  });

  it('should list the command catalog when --help is given', async () => {
    await driver.when.run(['--help']);

    expect(driver.get.stdout()).toMatch(
      /Commands:\n\s+generate, g\s+Generate a host/,
    );
  });

  it('should describe usage and options when a command is given with --help', async () => {
    await driver.when.run(['publish', '--help']);

    expect(driver.get.stdout()).toMatch(
      /atlas publish <project> \[options\][\s\S]*--registry-url <url>/,
    );
  });

  it('should resolve the generator alias when help is requested for g', async () => {
    await driver.when.run(['help', 'g', 'host']);

    expect(driver.get.stdout()).toMatch(/--framework <name>/);
  });

  it('should exit with an error when the command is unknown', async () => {
    await driver.when.run([faker.string.alpha({ length: 12 })]);

    expect([driver.get.result().code, driver.get.stderr()]).toStrictEqual([
      1,
      expect.stringMatching(/^✖ Unknown or incomplete command/),
    ]);
  });

  it('should require --app-id when a widget is generated non-interactively', async () => {
    await driver.when.run(['g', 'widget', faker.word.noun()]);

    expect(driver.get.stderr()).toMatch(
      /--app-id <app-id> is required to generate a widget in non-interactive mode/,
    );
  });
});
