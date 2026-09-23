import type { ValidationIssues } from '../../validation/validation-issues.js';
import { isLoopbackHostname } from '../../validation/validators.js';

export function validateRegistryRootUrl(input: {
  value: unknown;
  path: string;
  issues: ValidationIssues;
}): boolean {
  const { value, path, issues } = input;

  if (typeof value !== 'string' || value === '') {
    issues.add({ path, message: `Expected ${path} to be a non-empty string.` });

    return false;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    issues.add({
      path,
      message: `Expected ${path} "${value}" to be an absolute URL.`,
    });

    return false;
  }

  const secure =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && isLoopbackHostname(url.hostname));

  if (!secure) {
    issues.add({
      path,
      message: `Expected ${path} "${value}" to use HTTPS outside local development.`,
    });

    return false;
  }

  const normalized =
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    !value.endsWith('/');

  if (!normalized) {
    issues.add({
      path,
      message: `Expected ${path} "${value}" to be a normalized registry root without credentials, query, hash, or trailing slash.`,
    });

    return false;
  }

  return true;
}

export function resolveRegistryRootUrl(input: {
  value: unknown;
  path: string;
  runtimeConfigUrl: URL | undefined;
  issues: ValidationIssues;
}): string | undefined {
  const { value, path, runtimeConfigUrl, issues } = input;

  if (typeof value !== 'string' || value === '') {
    issues.add({ path, message: `Expected ${path} to be a non-empty string.` });

    return undefined;
  }

  if (isAbsoluteUrl(value)) {
    return validateRegistryRootUrl({ value, path, issues }) ? value : undefined;
  }

  if (!runtimeConfigUrl) {
    issues.add({
      path,
      message: `Expected ${path} "${value}" to be absolute, or a host URL to resolve it against.`,
    });

    return undefined;
  }

  const url = new URL(value, runtimeConfigUrl);
  const resolved =
    url.pathname.endsWith('/') && !url.search && !url.hash
      ? url.href.slice(0, -1)
      : url.href;

  return validateRegistryRootUrl({ value: resolved, path, issues })
    ? resolved
    : undefined;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
}
