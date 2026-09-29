import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ATLAS_IMMUTABLE_CACHE_CONTROL,
  type AtlasPayloadFileDescriptor,
  type AtlasPayloadFileRole,
} from '@atlas/schema';
import {
  resolvePublicationContentType,
  computeSha256Digest,
  forEachConcurrently,
} from '../../shared/index.js';

const PAYLOAD_READ_CONCURRENCY = 16;

export function normalizeArtifactPath(path: string): string {
  const normalized = convertToPosixPath(path);

  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..') ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(`Atlas payload path "${path}" is unsafe.`);
  }

  return normalized;
}

export function convertToPosixPath(path: string): string {
  return path.split('\\').join('/');
}

export function classifyPayloadRole(
  path: string,
  entryPath: string,
): AtlasPayloadFileRole {
  if (path === entryPath) return 'remote-entry';

  if (path.endsWith('.map')) return 'source-map';

  if (path.endsWith('.css')) return 'stylesheet';

  if (/\.(?:m?js|cjs)$/i.test(path)) return 'script';

  return 'asset';
}

export async function describePayloadFiles(options: {
  root: string;
  paths: readonly string[];
  entryPath: string;
}): Promise<AtlasPayloadFileDescriptor[]> {
  const normalizedEntry = normalizeArtifactPath(options.entryPath);
  const descriptorsByPath = new Map<string, AtlasPayloadFileDescriptor>();

  await forEachConcurrently({
    items: options.paths,
    concurrency: PAYLOAD_READ_CONCURRENCY,
    operation: async (path) => {
      const normalized = normalizeArtifactPath(path);
      const bytes = await readFile(join(options.root, path));

      descriptorsByPath.set(path, {
        path: normalized,
        digest: computeSha256Digest(bytes),
        size: bytes.byteLength,
        mediaType: resolvePublicationContentType(normalized),
        cacheControl: ATLAS_IMMUTABLE_CACHE_CONTROL,
        role: classifyPayloadRole(normalized, normalizedEntry),
      });
    },
  });

  return options.paths.map((path) => descriptorsByPath.get(path)!);
}
