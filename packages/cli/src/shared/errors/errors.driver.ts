import {
  extractErrorCause,
  extractErrorMessage,
  extractHttpStatus,
} from './errors.js';

export class ErrorsDriver {
  private error: unknown;

  readonly given = {
    error: (error: unknown): this => {
      this.error = error;

      return this;
    },
  };

  readonly get = {
    message: (): string => extractErrorMessage(this.error),
    status: (): number | undefined => extractHttpStatus(this.error),
    cause: (): unknown => extractErrorCause(this.error),
  };
}
