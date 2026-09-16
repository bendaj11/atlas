import { errorCauseOf, errorMessage, httpStatusOf } from './errors.js';

export class ErrorsDriver {
  private error: unknown;

  readonly given = {
    error: (error: unknown): this => {
      this.error = error;

      return this;
    },
  };

  readonly get = {
    message: (): string => errorMessage(this.error),
    status: (): number | undefined => httpStatusOf(this.error),
    cause: (): unknown => errorCauseOf(this.error),
  };
}
