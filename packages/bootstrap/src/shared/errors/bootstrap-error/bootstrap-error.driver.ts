import type { BootstrapError, BootstrapErrorCause } from '../index.js';

export type BootstrapErrorClass = new (
  message: string,
  options?: BootstrapErrorCause,
) => BootstrapError;

export class BootstrapErrorDriver {
  private error!: BootstrapError;

  readonly when = {
    created: ({
      ErrorClass,
      message,
      cause,
    }: BootstrapErrorCause & {
      ErrorClass: BootstrapErrorClass;
      message: string;
    }) => {
      this.error = new ErrorClass(
        message,
        cause === undefined ? {} : { cause },
      );
    },
  };

  readonly get = {
    error: () => this.error,
  };
}
