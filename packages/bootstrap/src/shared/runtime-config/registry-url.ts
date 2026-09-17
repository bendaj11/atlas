import { isLoopbackHostname } from '../loopback.js';
import { runtimeConfigError } from './runtime-config-error.js';

export function resolveRegistryUrl({
  value,
  runtimeConfigUrl,
  field,
}: {
  value: unknown;
  runtimeConfigUrl: URL | undefined;
  field: string;
}): string {
  if (typeof value !== 'string') {
    throw runtimeConfigError(`Atlas runtime ${field} is required.`);
  }

  if (isAbsoluteUrl(value)) {
    assertRegistryUrl({ value, field });

    return value;
  }

  if (!runtimeConfigUrl) {
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" is relative and requires a host URL to resolve against.`,
    );
  }

  const url = new URL(value, runtimeConfigUrl);
  const resolved =
    url.pathname.endsWith('/') && !url.search && !url.hash
      ? url.href.slice(0, -1)
      : url.href;

  assertRegistryUrl({ value: resolved, field });

  return resolved;
}

export function assertRegistryUrl({
  value,
  field,
}: {
  value: unknown;
  field: string;
}): void {
  if (typeof value !== 'string') {
    throw runtimeConfigError(`Atlas runtime ${field} is required.`);
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" must be an absolute URL.`,
    );
  }

  const secure =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && isLoopbackHostname(url.hostname));
  if (!secure) {
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" requires HTTPS outside local development.`,
    );
  }

  const normalized =
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    !value.endsWith('/');
  if (!normalized) {
    throw runtimeConfigError(
      `Atlas runtime ${field} "${value}" must be a normalized registry root without credentials, query, hash, or trailing slash.`,
    );
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
}
