import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import type {
  AtlasPublicationLease,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';
import { encodeManifestBytes } from '../static-registry/descriptors/descriptors.js';
import type { AtlasBuildResult } from '../../build/index.js';
import {
  computeSha256Digest,
  IMMUTABLE_CACHE_CONTROL,
} from '../../shared/index.js';

export interface PublicationFile {
  path: string;
  bytes: Uint8Array;
  metadata: AtlasPublicationObjectMetadata;
}

export interface PublicationFiles {
  readonly payloads: PublicationFile[];
  readonly manifest: PublicationFile;
}

export type PublicationProgressReporter = (message: string) => void;

export async function preparePublicationFiles(
  build: AtlasBuildResult,
): Promise<PublicationFiles> {
  const bytes = encodeManifestBytes(build.manifest);
  const prefix = resolveArtifactPrefix(build.manifest, bytes);
  const payloads = await Promise.all(
    build.manifest.files.map(async (file) => {
      const readSourceBytes = new Uint8Array(
        await readFile(join(build.sourceDirectory, file.path)),
      );
      assertPayload({
        path: file.path,
        bytes: readSourceBytes,
        expectedDigest: file.digest,
        expectedSize: file.size,
      });

      return {
        path: `${prefix}/${file.path}`,
        bytes: readSourceBytes,
        metadata: {
          cacheControl: file.cacheControl,
          contentType: file.mediaType,
        },
      };
    }),
  );

  return {
    payloads,
    manifest: {
      path: `${prefix}/manifest.json`,
      bytes,
      metadata: {
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        contentType: 'application/json',
      },
    },
  };
}

export function derivePublicationIdentity(
  manifest: AtlasPublishedArtifactManifest,
): string {
  const artifact = manifest.kind === 'app-artifact' ? 'app' : 'host';
  const version = manifest.release
    ? `release ${manifest.release.version}`
    : `preview #${manifest.preview!.number}`;

  return `${artifact} ${manifest.name} (${manifest.id}), ${version}`;
}

export async function uploadAndVerify(options: {
  storage: AtlasPublicationStorage;
  files: readonly PublicationFile[];
  lease?: AtlasPublicationLease;
  reportProgress?: PublicationProgressReporter;
}): Promise<void> {
  const { storage, files, lease, reportProgress = () => undefined } = options;
  reportProgress(
    `Uploading ${files.length} immutable file(s) to publication storage...`,
  );

  for (const file of files) {
    await lease?.assertHeld();
    await createImmutable(storage, file);
  }

  reportProgress(
    `Verifying ${files.length} uploaded immutable file(s) and metadata...`,
  );

  for (const file of files) {
    await lease?.assertHeld();
    const bytes = await storage.read(file.path);
    const metadata = await storage.inspect(file.path);

    if (!bytes || !metadata) {
      throw new Error(`Published object ${file.path} is missing.`);
    }

    assertPayload({
      path: file.path,
      bytes,
      expectedDigest: computeSha256Digest(file.bytes),
      expectedSize: file.bytes.byteLength,
    });
    assertMetadata(file.path, metadata, file.metadata);
  }
}

function resolveArtifactPrefix(
  manifest: AtlasPublishedArtifactManifest,
  bytes: Uint8Array,
): string {
  const collection = manifest.kind === 'app-artifact' ? 'apps' : 'hosts';

  if (manifest.release)
    return `${collection}/${manifest.id}/${manifest.release.version}`;

  const digest = computeSha256Digest(bytes).slice('sha256:'.length);

  return `${collection}/${manifest.id}/previews/${manifest.preview!.number}/${digest}`;
}

async function createImmutable(
  storage: AtlasPublicationStorage,
  file: PublicationFile,
): Promise<void> {
  try {
    await storage.create(file.path, file.bytes, file.metadata);
  } catch (error) {
    if (isUnknownOutcome(error)) throw error;
    const existing = await storage.read(file.path);
    const metadata = await storage.inspect(file.path);

    if (
      existing &&
      metadata &&
      computeSha256Digest(existing) === computeSha256Digest(file.bytes)
    ) {
      assertMetadata(file.path, metadata, file.metadata);

      return;
    }

    throw error;
  }
}

function isUnknownOutcome(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'publicationOutcomeUnknown' in error &&
    error.publicationOutcomeUnknown === true
  );
}

function assertPayload(options: {
  path: string;
  bytes: Uint8Array;
  expectedDigest: string;
  expectedSize: number;
}): void {
  const { path, bytes, expectedDigest, expectedSize } = options;

  if (
    bytes.byteLength !== expectedSize ||
    computeSha256Digest(bytes) !== expectedDigest
  ) {
    throw new Error(`Atlas payload ${path} changed after manifest generation.`);
  }
}

function assertMetadata(
  path: string,
  actual: AtlasPublicationObjectMetadata,
  expected: AtlasPublicationObjectMetadata,
): void {
  if (
    actual.cacheControl !== expected.cacheControl ||
    actual.contentType !== expected.contentType
  ) {
    throw new Error(`Atlas object ${path} has unexpected HTTP metadata.`);
  }
}
