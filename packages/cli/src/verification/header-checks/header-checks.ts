import type { AtlasManifest } from '@atlas/schema';
import { sha256Integrity } from '../../shared/digest/digest.js';
import type { VerificationChecks } from '../checks/checks.js';

export type ExpectedContentType = 'json' | 'css' | 'javascript';

export function checkCors(options: {
  checks: VerificationChecks;
  response: Response;
  url: URL;
  subject: string;
  hostOrigin: string;
}): void {
  const { checks, response, url, subject, hostOrigin } = options;
  if (url.origin === hostOrigin) return;
  const allowed = response.headers.get('access-control-allow-origin');
  if (allowed === '*' || allowed === hostOrigin)
    checks.pass(`${subject} CORS`, `Allows ${hostOrigin}.`);
  else
    checks.fail(
      `${subject} CORS`,
      `Expected Access-Control-Allow-Origin for ${hostOrigin}.`,
    );
}

export function checkMutableCache(options: {
  checks: VerificationChecks;
  response: Response;
  subject: string;
}): void {
  const { checks, response, subject } = options;
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (/\bimmutable\b/i.test(cacheControl))
    checks.fail(`${subject} cache`, 'Mutable metadata must not be immutable.');
  else if (!cacheControl)
    checks.warn(
      `${subject} cache`,
      'No Cache-Control header; use revalidation or a short max-age.',
    );
  else checks.pass(`${subject} cache`, cacheControl);
}

export function checkImmutableCache(options: {
  checks: VerificationChecks;
  response: Response;
  subject: string;
  channel: AtlasManifest['channel'];
}): void {
  const { checks, response, subject, channel } = options;
  if (channel === 'local') return;
  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAge = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*(\d+)\b/i)?.[1];
  if (
    /\bimmutable\b/i.test(cacheControl) &&
    maxAge !== undefined &&
    Number(maxAge) > 0
  )
    checks.pass(`${subject} cache`, cacheControl);
  else
    checks.warn(
      `${subject} cache`,
      'Versioned assets should use Cache-Control: public, max-age=31536000, immutable.',
    );
}

export function checkContentType(options: {
  checks: VerificationChecks;
  response: Response;
  subject: string;
  expected: ExpectedContentType;
}): void {
  const { checks, response, subject, expected } = options;
  const actual = response.headers.get('content-type')?.toLowerCase() ?? '';
  const valid = actual.includes(CONTENT_TYPE_FRAGMENTS[expected]);
  if (valid) checks.pass(`${subject} MIME`, actual);
  else
    checks.fail(
      `${subject} MIME`,
      `Expected ${CONTENT_TYPE_LABELS[expected]}, received "${actual || 'missing'}".`,
    );
}

export function checkIntegrity(options: {
  checks: VerificationChecks;
  bytes: Uint8Array;
  subject: string;
  integrity: string | undefined;
  channel: AtlasManifest['channel'];
}): void {
  const { checks, bytes, subject, integrity, channel } = options;
  if (!integrity) {
    checks.warn(
      `${subject} integrity`,
      channel === 'local'
        ? 'Skipped for a local manifest.'
        : 'Missing optional SHA-256 integrity metadata.',
    );

    return;
  }
  if (sha256Integrity(bytes) === integrity)
    checks.pass(`${subject} integrity`, 'SHA-256 matches.');
  else
    checks.fail(`${subject} integrity`, 'SHA-256 does not match the manifest.');
}

const CONTENT_TYPE_FRAGMENTS: Record<ExpectedContentType, string> = {
  json: 'json',
  css: 'text/css',
  javascript: 'javascript',
};

const CONTENT_TYPE_LABELS: Record<ExpectedContentType, string> = {
  json: 'JSON',
  css: 'text/css',
  javascript: 'JavaScript',
};
