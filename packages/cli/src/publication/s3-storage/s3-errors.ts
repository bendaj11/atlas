import { extractHttpStatus } from '../../shared/index.js';

export function isMissingObject(error: unknown): boolean {
  return (
    extractHttpStatus(error) === 404 ||
    errorName(error) === 'NoSuchKey' ||
    errorName(error) === 'NotFound'
  );
}

export function isPreconditionFailure(error: unknown): boolean {
  const status = extractHttpStatus(error);

  return (
    status === 409 ||
    status === 412 ||
    errorName(error) === 'PreconditionFailed'
  );
}

export class S3StorageError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`S3-compatible storage could not ${operation}.`, { cause });
    this.name = 'S3StorageError';
  }
}

function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}
