import {
  extractErrorCause,
  extractErrorMessage,
  extractHttpStatus,
} from './errors.js';

export class ErrorsDriver {
  private error: unknown;

  readonly given = {
    error: (error: unknown) => {
      this.error = error;

      return this;
    },
  };

  readonly get = {
    message: () => extractErrorMessage(this.error),
    status: () => extractHttpStatus(this.error),
    cause: () => extractErrorCause(this.error),
  };
}
