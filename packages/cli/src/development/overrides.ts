import { mkdir, writeFile } from 'node:fs/promises';
import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import { join } from 'node:path';

export async function writeDevOverrideDocument(
  projectRoot: string,
  document: AtlasRuntimeOverrideDocument,
): Promise<void> {
  const directory = join(projectRoot, '.atlas');
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'local-overrides.json'),
    `${JSON.stringify(document, null, 2)}\n`,
    'utf8',
  );
}
