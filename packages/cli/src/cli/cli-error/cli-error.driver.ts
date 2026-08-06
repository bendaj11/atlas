import { faker } from '@faker-js/faker';
import type { AtlasError } from '@atlas/schema';
import { createCliError } from './cli-error.js';

type ErrorScenario = 'browser' | 'build' | 'publish' | 'unknown';

export class CliErrorDriver {
  private readonly unknownCommand = faker.word.sample();
  private cause?: Error;
  private error?: AtlasError;

  readonly given = {
    error: (scenario: ErrorScenario): void => {
      const command = scenario === 'unknown' ? this.unknownCommand : scenario;
      this.cause = new Error(this.messageFor(scenario));
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
    unknownSummary: (): string =>
      `Unknown or incomplete command "${this.unknownCommand}".`,
  };

  private messageFor(scenario: ErrorScenario): string {
    if (scenario === 'unknown') return this.get.unknownSummary();
    if (scenario === 'build') return 'spawn vite ENOENT';
    if (scenario === 'publish') return 'S3 deployment lock is no longer owned.';

    return 'Atlas host failed. Suggested action: Correct atlas.runtime.json, then reload this page.';
  }
}
