import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import { hydratePublishedArtifactManifest } from '@atlas/schema';
import { fetchBytes } from '../fetch-json/fetch-json.js';
import { artifactUrl } from '../runtime-config/runtime-config.js';

export async function loadPublishedArtifact(
  reference: AtlasManifestDescriptor,
  runtime: AtlasHostRuntimeConfig,
): Promise<AtlasManifest | AtlasHostManifest> {
  const url = artifactUrl(runtime, reference.path);
  const bytes = await fetchBytes(url, runtime);
  await assertDescriptor(reference, bytes);
  return hydratePublishedArtifactManifest(
    JSON.parse(new TextDecoder().decode(bytes)),
    url,
  );
}

async function assertDescriptor(
  descriptor: AtlasManifestDescriptor,
  bytes: Uint8Array,
): Promise<void> {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  const actual = `sha256:${[...hash]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
  if (bytes.byteLength !== descriptor.size || actual !== descriptor.digest) {
    throw new Error(
      `Artifact manifest ${descriptor.path} failed descriptor verification.`,
    );
  }
}
