import type { AtlasManifestDescriptor } from '@atlas/schema';
import { ArtifactVerificationFailedError } from '../../../shared/errors/index.js';
import {
  convertBytesToHex,
  computeSha256,
} from '../../../shared/sha256/sha256.js';

export async function assertBytesMatchDescriptor(
  bytes: Uint8Array,
  descriptor: AtlasManifestDescriptor,
): Promise<void> {
  if (bytes.byteLength !== descriptor.size) {
    throw new ArtifactVerificationFailedError(
      `Artifact manifest "${descriptor.path}" is ${bytes.byteLength} bytes but its descriptor records ${descriptor.size} bytes.`,
    );
  }

  const actual = `sha256:${convertBytesToHex(await computeSha256(bytes))}`;

  if (actual !== descriptor.digest) {
    throw new ArtifactVerificationFailedError(
      `Artifact manifest "${descriptor.path}" digest ${actual} does not match its descriptor digest ${descriptor.digest}.`,
    );
  }
}
