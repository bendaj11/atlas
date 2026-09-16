import {
  integrityFromDigest,
  sha256Digest,
  sha256Integrity,
  type Sha256Digest,
} from './digest.js';

export class DigestDriver {
  private bytes: Uint8Array = new Uint8Array();

  readonly given = {
    bytes: (bytes: Uint8Array | string): this => {
      this.bytes =
        typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;

      return this;
    },
  };

  readonly get = {
    digest: (): Sha256Digest => sha256Digest(this.bytes),
    integrity: (): string => sha256Integrity(this.bytes),
    integrityFromDigest: (digest: Sha256Digest): string =>
      integrityFromDigest(digest),
  };
}
