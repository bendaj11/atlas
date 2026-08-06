import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

interface CorruptAngularBuildPackage {
  version: string;
  sourcePath: string;
}

export async function assertUsableAngularBuildPackage(
  workspaceRoot: string,
  projectRoot: string,
): Promise<void> {
  const corruptPackage =
    (await findCorruptAngularBuildPackage(projectRoot)) ??
    (await findCorruptAngularBuildPackage(workspaceRoot));
  if (!corruptPackage) return;

  throw new Error(
    [
      `Angular dev server cannot start because @angular/build ${corruptPackage.version} is corrupt.`,
      `${corruptPackage.sourcePath} calls creadConfiguration(...), but @angular/compiler-cli exports readConfiguration.`,
      'Pin Angular build tooling to a fixed patch, reinstall node_modules, then run atlas dev again.',
    ].join(' '),
  );
}

async function findCorruptAngularBuildPackage(
  root: string,
): Promise<CorruptAngularBuildPackage | undefined> {
  try {
    const requireFromRoot = createRequire(join(root, 'package.json'));
    const packagePath = requireFromRoot.resolve('@angular/build/package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
      version?: unknown;
    };
    const sourcePath = join(
      dirname(packagePath),
      'src/tools/angular/compilation/angular-compilation.js',
    );
    const source = await readFile(sourcePath, 'utf8');
    if (!source.includes('creadConfiguration(')) return undefined;
    return {
      version:
        typeof packageJson.version === 'string'
          ? packageJson.version
          : 'unknown',
      sourcePath,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'MODULE_NOT_FOUND' || error.code === 'ENOENT')
    ) {
      return undefined;
    }
    throw error;
  }
}
