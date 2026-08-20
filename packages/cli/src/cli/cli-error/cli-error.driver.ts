import { faker } from '@faker-js/faker';
import type { AtlasError } from '@atlas/schema';
import { createCliError, formatErrorWithCauses } from './cli-error.js';

type ErrorScenario =
  'aggregate' | 'browser' | 'build' | 'publish' | 'storage' | 'unknown';

export class CliErrorDriver {
  private readonly unknownCommand = faker.word.sample();
  private cause?: Error;
  private error?: AtlasError;

  readonly given = {
    error: (scenario: ErrorScenario): void => {
      const command = scenario === 'unknown' ? this.unknownCommand : scenario;
      this.cause =
        scenario === 'storage'
          ? this.storageError()
          : scenario === 'aggregate'
            ? new AggregateError(
                [
                  new Error('Registry restore failed.'),
                  new Error('Lease release failed.'),
                ],
                this.messageFor(scenario),
              )
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
    if (scenario === 'build') return 'spawn vite ENOENT';
    if (scenario === 'publish') return 'S3 deployment lock is no longer owned.';
    if (scenario === 'storage')
      return 'S3-compatible storage could not acquire deployment lock.';
    if (scenario === 'aggregate') return 'Publication cleanup failed.';

    return 'Atlas host failed. Suggested action: Correct atlas.runtime.json, then reload this page.';
  }

  private storageError(): Error {
    const cause = Object.assign(new Error('AccessDenied'), {
      $metadata: {
        attempts: 2,
        extendedRequestId: faker.string.alphanumeric(),
        httpStatusCode: 403,
        requestId: faker.string.uuid(),
      },
    });
    return new Error(this.messageFor('storage'), { cause });
  }
}
