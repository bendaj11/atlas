import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface AtlasPackageMetadata {
  atlas?: {
    previews?: unknown;
  };
}

export async function readAtlasPreviewUrls(
  projectRoot: string,
): Promise<readonly string[]> {
  const packageJson = JSON.parse(
    await readFile(join(projectRoot, 'package.json'), 'utf8'),
  ) as AtlasPackageMetadata;
  const previews = packageJson.atlas?.previews;
  if (previews === undefined) return [];
  if (!Array.isArray(previews)) {
    throw new Error(
      'package.json atlas.previews must be an array of HTTP URLs.',
    );
  }
  return previews.map(assertPreviewUrl);
}

function assertPreviewUrl(value: unknown, index: number): string {
  if (typeof value !== 'string') return invalidPreviewUrl(index);
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return value;
  } catch {
    return invalidPreviewUrl(index);
  }
  return invalidPreviewUrl(index);
}

function invalidPreviewUrl(index: number): never {
  throw new Error(
    `package.json atlas.previews[${index}] must be an absolute HTTP URL.`,
  );
}
