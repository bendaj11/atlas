import { httpStatusOf } from '../../shared/index.js';

export function isMissingObject(error: unknown): boolean {
  return (
    httpStatusOf(error) === 404 ||
    errorName(error) === 'NoSuchKey' ||
    errorName(error) === 'NotFound'
  );
}

export function isPreconditionFailure(error: unknown): boolean {
  const status = httpStatusOf(error);

  return (
    status === 409 ||
    status === 412 ||
    errorName(error) === 'PreconditionFailed'
  );
}

export function storageError(operation: string, cause: unknown): Error {
  return new Error(`S3-compatible storage could not ${operation}.`, { cause });
}

function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}
