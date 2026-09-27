import { ArtifactVerificationFailedError } from '../../../shared/errors/index.js';
import {
  convertBytesToBase64,
  computeSha256,
} from '../../../shared/sha256/sha256.js';

export async function validateIntegrity(
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  if (!expected.startsWith('sha256-')) {
    throw new ArtifactVerificationFailedError(
      `Host integrity "${expected}" must be a SHA-256 SRI value starting with "sha256-".`,
    );
  }

  const actual = 'sha256-' + convertBytesToBase64(await computeSha256(bytes));

  if (actual !== expected) {
    throw new ArtifactVerificationFailedError(
      `Selected host remote entry integrity ${actual} does not match manifest integrity ${expected}.`,
    );
  }
}
