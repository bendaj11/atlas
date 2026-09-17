import type { AtlasError } from '@atlas/schema';
import { createCliError, formatErrorWithCauses } from './cli-error.js';

export class CliErrorDriver {
  private command?: string;
  private cause: unknown;
  private error!: AtlasError;

  readonly given = {
    command: (command: string | undefined): this => {
      this.command = command;

      return this;
    },
    cause: (cause: unknown): this => {
      this.cause = cause;

      return this;
    },
  };

  readonly when = {
    created: (): void => {
      this.error = createCliError(this.command, this.cause);
    },
  };

  readonly get = {
    error: (): AtlasError => this.error,
    formattedError: (): string => formatErrorWithCauses(this.error),
  };
}
