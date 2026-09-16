import { createHash } from 'node:crypto';

export type Sha256Digest = `sha256:${string}`;

export function sha256Digest(bytes: Uint8Array | string): Sha256Digest {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function sha256Integrity(bytes: Uint8Array): string {
  return `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
}

export function integrityFromDigest(digest: Sha256Digest): string {
  return `sha256-${Buffer.from(digest.slice('sha256:'.length), 'hex').toString('base64')}`;
}
