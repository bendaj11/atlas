import { hydratePublishedArtifactManifest } from '@atlas/schema';
import type { ArtifactVersion } from '../../../types/artifact-version';

export interface ManifestDescriptor {
  path: string;
  digest: string;
  size: number;
  mediaType: 'application/json';
}

export interface ManifestReference extends ManifestDescriptor {
  url: string;
}

const FETCH_TIMEOUT_MS = 5_000;

export function manifestReference(
  registryRoot: string,
  descriptor: ManifestDescriptor,
): ManifestReference {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${registryRoot}/`).href,
  };
}

export async function fetchWithTimeout(
  input: string | URL,
  cache: RequestCache = 'no-store',
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, { cache, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchVerifiedManifest(
  reference: ManifestReference,
): Promise<ArtifactVersion> {
  const response = await fetchWithTimeout(reference.url, 'force-cache');
  if (!response.ok)
    throw new Error(`${reference.url} returned ${response.status}.`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  await assertMatchesDescriptor(reference, bytes);

  return hydratePublishedArtifactManifest(
    JSON.parse(new TextDecoder().decode(bytes)),
    reference.url,
  ) as ArtifactVersion;
}

async function assertMatchesDescriptor(
  descriptor: ManifestDescriptor,
  bytes: Uint8Array,
): Promise<void> {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
  );
  const digest = `sha256:${[...hash]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
  if (descriptor.size !== bytes.byteLength || descriptor.digest !== digest)
    throw new Error(`${descriptor.path} failed descriptor verification.`);
}
