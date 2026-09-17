import {
  isMissingObject,
  isPreconditionFailure,
  S3StorageError,
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
      new S3StorageError(operation, this.error),
  };
}
