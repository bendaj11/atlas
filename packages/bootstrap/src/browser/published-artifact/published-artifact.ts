import type {
  AtlasHostManifest,
  AtlasHostRuntimeConfig,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import { hydratePublishedArtifactManifest } from '@atlas/schema';
import { bootstrapError } from '../../shared/errors/bootstrap-error.js';
import { fetchBytes } from '../fetch-json/fetch-json.js';
import { artifactUrl } from '../../shared/runtime-config/runtime-config.js';
import { decodeJson } from '../../shared/decode-json.js';
import { sha256, toHex } from '../../shared/sha256.js';

export interface PublishedArtifactDependencies {
  readonly fetchBytes: typeof fetchBytes;
  readonly hydratePublishedArtifactManifest: typeof hydratePublishedArtifactManifest;
}

export interface LoadPublishedArtifactOptions {
  reference: AtlasManifestDescriptor;
  runtime: AtlasHostRuntimeConfig;
  dependencies?: PublishedArtifactDependencies;
}

export async function loadPublishedArtifact({
  reference,
  runtime,
  dependencies = defaultDependencies(),
}: LoadPublishedArtifactOptions): Promise<AtlasManifest | AtlasHostManifest> {
  const url = artifactUrl(runtime, reference.path);
  const bytes = await dependencies.fetchBytes({ url, runtime });
  await assertBytesMatchDescriptor(bytes, reference);

  return dependencies.hydratePublishedArtifactManifest(decodeJson(bytes), url);
}

function defaultDependencies(): PublishedArtifactDependencies {
  return { fetchBytes, hydratePublishedArtifactManifest };
}

async function assertBytesMatchDescriptor(
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
