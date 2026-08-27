import { faker } from '@faker-js/faker';
import type { AtlasError } from '@atlas/schema';
import { createCliError, formatErrorWithCauses } from './cli-error.js';

type ErrorScenario = 'browser' | 'publish' | 'storage' | 'unknown';

export class CliErrorDriver {
  private readonly unknownCommand = faker.word.sample();
  private cause?: Error;
  private error?: AtlasError;

  readonly given = {
    error: (scenario: ErrorScenario): void => {
      const command = scenario === 'unknown' ? this.unknownCommand : scenario;
      this.cause =
        scenario === 'storage'
          ? new Error(this.messageFor(scenario), {
              cause: new Error('AccessDenied', {
                cause: { httpStatusCode: 403 },
              }),
            })
          : new Error(this.messageFor(scenario));
      this.error = createCliError(
        scenario === 'browser' ? 'verify' : command,
        this.cause,
      );
    },
  };

  readonly get = {
    error: (): AtlasError => {
      if (!this.error) throw new Error('CLI error was not available.');

      return this.error;
    },
    cause: (): Error => {
      if (!this.cause) throw new Error('Error cause was not available.');

      return this.cause;
    },
    formattedError: (): string => formatErrorWithCauses(this.get.error()),
    unknownSummary: (): string =>
      `Unknown or incomplete command "${this.unknownCommand}".`,
  };

  private messageFor(scenario: ErrorScenario): string {
    if (scenario === 'unknown') return this.get.unknownSummary();
    if (scenario === 'publish') return 'S3 deployment lock is no longer owned.';
    if (scenario === 'storage')
      return 'S3-compatible storage could not acquire deployment lock.';

    return 'Atlas host failed. Suggested action: Correct host runtime configuration, then reload this page.';
  }
}
