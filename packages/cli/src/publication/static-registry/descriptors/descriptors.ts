import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import { computeSha256Digest } from '../../../shared/index.js';
import { stringifyCanonicalJson } from '../revision/registry-revision.js';

export function encodeManifestBytes(
  manifest: AtlasPublishedArtifactManifest,
): Uint8Array {
  return new TextEncoder().encode(`${stringifyCanonicalJson(manifest)}\n`);
}

export function createManifestDescriptor(
  path: string,
  bytes: Uint8Array,
): AtlasManifestDescriptor {
  return {
    path,
    digest: computeSha256Digest(bytes),
    size: bytes.byteLength,
    mediaType: 'application/json',
  };
}

export function isSameDescriptor(
  left: AtlasManifestDescriptor | undefined,
  right: AtlasManifestDescriptor,
): boolean {
  return Boolean(
    left &&
    left.path === right.path &&
    left.digest === right.digest &&
    left.size === right.size &&
    left.mediaType === right.mediaType,
  );
}
