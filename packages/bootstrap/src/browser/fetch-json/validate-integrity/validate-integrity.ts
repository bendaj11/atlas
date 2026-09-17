import { bootstrapError } from '../../../shared/errors/index.js';
import { sha256, toBase64 } from '../../../shared/sha256/sha256.js';

export async function validateIntegrity(
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  if (!expected.startsWith('sha256-'))
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Host integrity "${expected}" must be a SHA-256 SRI value starting with "sha256-".`,
    });

  const actual = 'sha256-' + toBase64(await sha256(bytes));
  if (actual !== expected)
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Selected host remote entry integrity ${actual} does not match manifest integrity ${expected}.`,
    });
}
