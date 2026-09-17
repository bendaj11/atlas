import { extractHttpStatus } from '../../shared/index.js';

export function isMissingObject(error: unknown): boolean {
  return (
    extractHttpStatus(error) === 404 ||
    extractErrorName(error) === 'NoSuchKey' ||
    extractErrorName(error) === 'NotFound'
  );
}

export function isPreconditionFailure(error: unknown): boolean {
  const status = extractHttpStatus(error);

  return (
    status === 409 ||
    status === 412 ||
    extractErrorName(error) === 'PreconditionFailed'
  );
}

export class S3StorageError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`S3-compatible storage could not ${operation}.`, { cause });
    this.name = 'S3StorageError';
  }
}

function extractErrorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}
