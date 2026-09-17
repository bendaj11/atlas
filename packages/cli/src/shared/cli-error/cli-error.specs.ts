import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import { CliErrorDriver } from './cli-error.driver.js';

describe('normalizeToCliError', () => {
  let driver: CliErrorDriver;

  beforeEach(() => {
    driver = new CliErrorDriver();
  });

  describe('when the cause is a plain error for an unknown command', () => {
    const command = faker.word.sample();
    const summary = `Unknown or incomplete command "${command}".`;

    beforeEach(() => {
      driver.given
        .command(command)
        .given.cause(new Error(summary))
        .when.created();
    });

    it('should retain summary when created', () => {
      expect(driver.get.error().summary).toBe(summary);
    });

    it('should suggest command help when created', () => {
      expect(driver.get.error().suggestedActions).toStrictEqual([
        'Run `atlas --help` to choose a supported command, then retry with the documented arguments.',
      ]);
    });
  });

  describe('when the cause is a storage error for publish', () => {
    beforeEach(() => {
      driver.given
        .command('publish')
        .given.cause(new Error('S3 deployment lock is no longer owned.'))
        .when.created();
    });

    it('should prefix summary with the command when created', () => {
      expect(driver.get.error().summary).toBe(
        'Atlas publish failed: S3 deployment lock is no longer owned.',
      );
    });

    it('should suggest storage recovery when created', () => {
      expect(driver.get.error().suggestedActions[0]).toMatch(
        /storage, registry, credentials, or deployment-lock/,
      );
    });

    it('should suggest rerun of the command when created', () => {
      expect(driver.get.error().suggestedActions[1]).toBe(
        'Rerun `atlas publish` after correcting the condition.',
      );
    });
  });

  it('should resolve the command alias when command is g', () => {
    driver.given
      .command('g')
      .given.cause(new Error(faker.lorem.sentence()))
      .when.created();

    expect(driver.get.error().suggestedActions[0]).toMatch(
      /rerun `atlas generate`/,
    );
  });

  it('should include cause chain with HTTP status when cause carries SDK metadata', () => {
    driver.given
      .command('publish')
      .given.cause(
        new Error('S3-compatible storage could not acquire deployment lock.', {
          cause: Object.assign(new Error('AccessDenied'), {
            $metadata: { httpStatusCode: 403 },
          }),
        }),
      )
      .when.created();

    expect(driver.get.formattedError()).toContain(
      'Caused by: Error: AccessDenied (HTTP 403)',
    );
  });

  it('should wrap non-error values when cause is a string', () => {
    const value = faker.lorem.sentence();
    driver.given.command('dev').given.cause(value).when.created();

    expect(driver.get.error().cause).toStrictEqual(new Error(value));
  });

  describe('when the cause is a browser-surface AtlasError', () => {
    beforeEach(() => {
      driver.given
        .command('verify')
        .given.cause(
          new AtlasError('Atlas host failed.', {
            suggestedActions: 'Reload this page.',
            surface: 'browser',
          }),
        )
        .when.created();
    });

    it('should set CLI surface when created', () => {
      expect(driver.get.error().surface).toBe('cli');
    });

    it('should replace browser recovery with CLI recovery when created', () => {
      expect(driver.get.error().suggestedActions).toStrictEqual([
        'Correct each failed deployment URL, response header, or artifact, deploy the fix, then rerun `atlas verify`.',
      ]);
    });
  });

  it('should return the same error when cause is a CLI-surface AtlasError', () => {
    const cause = new AtlasError(faker.lorem.sentence(), {
      suggestedActions: faker.lorem.sentence(),
      surface: 'cli',
    });
    driver.given.command('publish').given.cause(cause).when.created();

    expect(driver.get.error()).toBe(cause);
  });

  describe('when the cause is a universal AtlasError', () => {
    const summary = faker.lorem.sentence();
    const action = faker.lorem.sentence();
    const code = faker.string.alpha({ length: 8, casing: 'upper' });
    const innerCause = new Error(faker.lorem.word());

    beforeEach(() => {
      driver.given
        .command('deploy')
        .given.cause(
          new AtlasError(summary, {
            suggestedActions: action,
            code,
            cause: innerCause,
          }),
        )
        .when.created();
    });

    it('should keep the summary when created', () => {
      expect(driver.get.error().summary).toBe(summary);
    });

    it('should keep the suggested actions when created', () => {
      expect(driver.get.error().suggestedActions).toStrictEqual([action]);
    });

    it('should keep the code when created', () => {
      expect(driver.get.error().code).toBe(code);
    });

    it('should keep the inner cause when created', () => {
      expect(driver.get.error().cause).toBe(innerCause);
    });

    it('should set CLI surface when created', () => {
      expect(driver.get.error().surface).toBe('cli');
    });
  });
});
