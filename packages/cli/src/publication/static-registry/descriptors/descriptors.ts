import type {
  AtlasManifestDescriptor,
  AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import { sha256Digest } from '../../../shared/index.js';
import { canonicalJson } from '../revision/registry-revision.js';

export function manifestBytes(
  manifest: AtlasPublishedArtifactManifest,
): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(manifest)}\n`);
}

export function descriptorFor(
  path: string,
  bytes: Uint8Array,
): AtlasManifestDescriptor {
  return {
    path,
    digest: sha256Digest(bytes),
    size: bytes.byteLength,
    mediaType: 'application/json',
  };
}

export function sameDescriptor(
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
