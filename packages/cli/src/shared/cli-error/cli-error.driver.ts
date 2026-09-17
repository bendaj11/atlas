import type { AtlasError } from '@atlas/schema';
import { normalizeToCliError, formatErrorWithCauses } from './cli-error.js';

export class CliErrorDriver {
  private command?: string;
  private cause: unknown;
  private error!: AtlasError;

  readonly given = {
    command: (command: string | undefined) => {
      this.command = command;

      return this;
    },
    cause: (cause: unknown) => {
      this.cause = cause;

      return this;
    },
  };

  readonly when = {
    created: () => {
      this.error = normalizeToCliError(this.command, this.cause);
    },
  };

  readonly get = {
    error: () => this.error,
    formattedError: () => formatErrorWithCauses(this.error),
  };
}
