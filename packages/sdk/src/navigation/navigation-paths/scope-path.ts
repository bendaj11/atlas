import { sdkError } from '../../core/sdk-error/sdk-error.js';
import { normalizePath } from './normalize-path.js';

const ABSOLUTE_URL = /^https?:\/\//;

/** Maps an app-relative or app-absolute target onto the host path assigned to the app. */
export function scopePath(path: string, to: string): string {
  const normalizedPath = normalizePath(path);
  assertSameOrigin(to);

  if (isInsideAppPath(to, normalizedPath)) return to;

  const child = to.startsWith('/') ? to.slice(1) : to;

  if (child.length === 0) return normalizedPath;

  if (child.startsWith('?') || child.startsWith('#')) {
    return `${normalizedPath}${child}`;
  }

  return normalizedPath === '/' ? `/${child}` : `${normalizedPath}/${child}`;
}

function assertSameOrigin(to: string): void {
  if (!ABSOLUTE_URL.test(to)) return;

  throw sdkError(
    `Atlas cannot navigate to absolute URL "${to}" through scoped app navigation.`,
    {
      suggestedActions:
        'Pass a same-origin path such as /orders; use the browser or host navigation API for external URLs.',
      code: 'ATLAS_EXTERNAL_SCOPED_NAVIGATION',
    },
  );
}

function isInsideAppPath(to: string, path: string): boolean {
  if (path === '/') return to.startsWith('/');

  return (
    to === path ||
    to.startsWith(`${path}/`) ||
    to.startsWith(`${path}?`) ||
    to.startsWith(`${path}#`)
  );
}
