import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  type AtlasPublishedArtifactManifest,
} from '@atlas/schema';
import type {
  AtlasPublicationLease,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
} from '../publication-storage/types.js';
import { encodeManifestBytes } from '../static-registry/descriptors/descriptors.js';
import type { AtlasBuildResult } from '../../build/index.js';
import {
  computeSha256Digest,
  forEachConcurrently,
  formatBytes,
  pluralize,
  silentProgress,
  type AtlasProgressReporter,
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
        cacheControl: ATLAS_IMMUTABLE_CACHE_CONTROL,
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

export function measurePublicationFiles(files: PublicationFiles): {
  count: number;
  bytes: number;
} {
  const all = [...files.payloads, files.manifest];

  return {
    count: all.length,
    bytes: all.reduce((total, file) => total + file.bytes.byteLength, 0),
  };
}

export async function uploadAndVerify(options: {
  storage: AtlasPublicationStorage;
  files: PublicationFiles;
  concurrency: number;
  lease?: AtlasPublicationLease;
  progress?: AtlasProgressReporter;
}): Promise<void> {
  const {
    storage,
    files,
    concurrency,
    lease,
    progress = silentProgress,
  } = options;
  const { count, bytes } = measurePublicationFiles(files);
  const size = formatBytes(bytes);
  let uploaded = 0;

  const upload = async (file: PublicationFile): Promise<void> => {
    await lease?.assertHeld();
    await createImmutable(storage, file);
    uploaded += 1;
    progress.update(`Uploading files ${uploaded}/${count} (${size})`);
  };

  progress.start(`Uploading files 0/${count} (${size})`);
  await forEachConcurrently({
    items: files.payloads,
    concurrency,
    operation: upload,
  });
  await upload(files.manifest);
  progress.succeed(`Uploaded ${pluralize(count, 'file')} (${size})`);

  if (storage.verifiesCreatedObjects) return;

  let verified = 0;

  progress.start(`Verifying uploaded files 0/${count}`);
  await forEachConcurrently({
    items: [...files.payloads, files.manifest],
    concurrency,
    operation: async (file) => {
      await lease?.assertHeld();
      await verifyStoredObject(storage, file);
      verified += 1;
      progress.update(`Verifying uploaded files ${verified}/${count}`);
    },
  });
  progress.succeed(`Verified ${pluralize(count, 'uploaded file')}`);
}

async function verifyStoredObject(
  storage: AtlasPublicationStorage,
  file: PublicationFile,
): Promise<void> {
  const [bytes, metadata] = await Promise.all([
    storage.read(file.path),
    storage.inspect(file.path),
  ]);

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
