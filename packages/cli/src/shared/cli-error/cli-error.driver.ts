import type { AtlasError } from '@atlas/schema';
import { normalizeToCliError, formatErrorWithCauses } from './cli-error.js';

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
      this.error = normalizeToCliError(this.command, this.cause);
    },
  };

  readonly get = {
    error: (): AtlasError => this.error,
    formattedError: (): string => formatErrorWithCauses(this.error),
  };
}
