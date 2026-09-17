import type { AtlasManifestDescriptor } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/index.js';
import { sha256, toHex } from '../../shared/sha256.js';

export async function assertBytesMatchDescriptor(
  bytes: Uint8Array,
  descriptor: AtlasManifestDescriptor,
): Promise<void> {
  if (bytes.byteLength !== descriptor.size)
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Artifact manifest "${descriptor.path}" is ${bytes.byteLength} bytes but its descriptor records ${descriptor.size} bytes.`,
    });

  const actual = `sha256:${toHex(await sha256(bytes))}`;
  if (actual !== descriptor.digest)
    throw bootstrapError({
      code: 'ARTIFACT_VERIFICATION_FAILED',
      message: `Artifact manifest "${descriptor.path}" digest ${actual} does not match its descriptor digest ${descriptor.digest}.`,
    });
}
