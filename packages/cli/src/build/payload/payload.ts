import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtlasPayloadFileDescriptor } from '@atlas/schema';
import {
  IMMUTABLE_CACHE_CONTROL,
  publicationContentType,
  sha256Digest,
} from '../../shared/index.js';

export function normalizeArtifactPath(path: string): string {
  const normalized = toPosixPath(path);
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

export function toPosixPath(path: string): string {
  return path.split('\\').join('/');
}

export function payloadRole(
  path: string,
  entryPath: string,
): AtlasPayloadFileDescriptor['role'] {
  if (path === entryPath) return 'remote-entry';
  if (path.endsWith('.map')) return 'source-map';
  if (path.endsWith('.css')) return 'stylesheet';
  if (/\.(?:m?js|cjs)$/i.test(path)) return 'script';

  return 'asset';
}

export async function payloadDescriptors(options: {
  root: string;
  paths: readonly string[];
  entryPath: string;
}): Promise<AtlasPayloadFileDescriptor[]> {
  const normalizedEntry = normalizeArtifactPath(options.entryPath);

  return Promise.all(
    options.paths.map(async (path) => {
      const normalized = normalizeArtifactPath(path);
      const bytes = await readFile(join(options.root, path));

      return {
        path: normalized,
        digest: sha256Digest(bytes),
        size: bytes.byteLength,
        mediaType: publicationContentType(normalized),
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        role: payloadRole(normalized, normalizedEntry),
      };
    }),
  );
}
