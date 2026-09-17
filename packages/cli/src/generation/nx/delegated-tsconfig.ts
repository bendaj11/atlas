import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  doesPathExist,
  writeJsonFile,
  type SupportedFramework,
  recordOrEmpty,
} from '../../shared/index.js';
import { addUniqueString } from '../files/files.js';

const ATLAS_CONFIG_FILE = 'atlas.config.ts';

export async function alignDelegatedTsconfig({
  root,
  framework,
}: {
  root: string;
  framework: SupportedFramework;
}): Promise<void> {
  const target = await findTsconfigPath(root);

  if (!target) return;

  const tsconfig = JSON.parse(await readFile(target, 'utf8')) as Record<
    string,
    unknown
  >;
  const compilerOptions = recordOrEmpty(tsconfig.compilerOptions);

  if (framework === 'angular') {
    compilerOptions.emitDeclarationOnly = false;
  } else {
    compilerOptions.module = 'ESNext';
    compilerOptions.moduleResolution = 'bundler';
    compilerOptions.types = addUniqueString(
      Array.isArray(compilerOptions.types) ? compilerOptions.types : [],
      'vite/client',
    );
  }

  tsconfig.compilerOptions = compilerOptions;
  includeAtlasConfig(tsconfig);

  await writeJsonFile(target, tsconfig);
}

async function findTsconfigPath(root: string): Promise<string | undefined> {
  const appTsconfig = join(root, 'tsconfig.app.json');
  const target = (await doesPathExist(appTsconfig))
    ? appTsconfig
    : join(root, 'tsconfig.json');

  return (await doesPathExist(target)) ? target : undefined;
}

function includeAtlasConfig(tsconfig: Record<string, unknown>): void {
  if (Array.isArray(tsconfig.files)) {
    tsconfig.files = addUniqueString(tsconfig.files, ATLAS_CONFIG_FILE);

    return;
  }

  tsconfig.include = addUniqueString(
    Array.isArray(tsconfig.include) ? tsconfig.include : [],
    ATLAS_CONFIG_FILE,
  );
}
