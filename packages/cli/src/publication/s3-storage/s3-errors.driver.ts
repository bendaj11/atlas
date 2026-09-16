import {
  isMissingObject,
  isPreconditionFailure,
  storageError,
} from './s3-errors.js';

export class S3ErrorsDriver {
  private error: unknown;

  readonly given = {
    error: (error: unknown): this => {
      this.error = error;

      return this;
    },
  };

  readonly get = {
    missing: (): boolean => isMissingObject(this.error),
    precondition: (): boolean => isPreconditionFailure(this.error),
    storageError: (operation: string): Error =>
      storageError(operation, this.error),
  };
}
