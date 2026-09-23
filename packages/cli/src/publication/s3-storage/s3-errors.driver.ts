import {
  isMissingObject,
  isPreconditionFailure,
  S3StorageError,
} from './s3-errors.js';

export class S3ErrorsDriver {
  private error: unknown;

  readonly given = {
    error: (error: unknown) => {
      this.error = error;

      return this;
    },
  };

  readonly get = {
    missing: () => isMissingObject(this.error),
    precondition: () => isPreconditionFailure(this.error),
    storageError: (operation: string) =>
      new S3StorageError(operation, this.error),
  };
}
