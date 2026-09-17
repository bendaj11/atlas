import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { federationConfigError } from '../federation-config-error/federation-config-error.cjs';
import { rootPackageName } from '../runtime-imports/index.cjs';

export interface InstalledPackageInfo {
  readonly version: string;
  readonly exports?: unknown;
  readonly directory: string;
}

interface ProjectPackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

/** `dependencies` merged with `peerDependencies` of the project package.json; empty when the file is absent. */
export function declaredPackageRanges(
  packagePath: string,
): Record<string, string> {
  const packageJson: ProjectPackageJson = existsSync(packagePath)
    ? (JSON.parse(readFileSync(packagePath, 'utf8')) as ProjectPackageJson)
    : {};

  return { ...packageJson.dependencies, ...packageJson.peerDependencies };
}

/** Resolves a specifier from the project; `undefined` when Node cannot resolve it. */
export function resolveSharedEntry(
  requireFromProject: NodeJS.Require,
  specifier: string,
): string | undefined {
  try {
    return requireFromProject.resolve(specifier);
  } catch {
    return undefined;
  }
}

/** Reads version, exports, and real directory of an installed package, even when its export map hides package.json. */
export function readInstalledPackageInfo(
  requireFromProject: NodeJS.Require,
  packageName: string,
  specifier: string,
): InstalledPackageInfo {
  const candidates = (requireFromProject.resolve.paths(packageName) ?? []).map(
    (directory) => join(directory, packageName, 'package.json'),
  );
  const exported = resolveSharedEntry(
    requireFromProject,
    `${packageName}/package.json`,
  );

  if (exported) candidates.unshift(exported);

  const packagePath = candidates.find((candidate) => existsSync(candidate));

  if (!packagePath) {
    throw federationConfigError(
      `Atlas could not resolve package metadata for shared dependency "${specifier}".`,
      {
        suggestedActions: `Install "${packageName}" in the project (it is declared but not resolvable from its package.json), then rebuild.`,
        code: 'ATLAS_SHARED_PACKAGE_NOT_INSTALLED',
      },
    );
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    version: string;
    exports?: unknown;
  };

  return {
    version: packageJson.version,
    ...(packageJson.exports !== undefined
      ? { exports: packageJson.exports }
      : {}),
    directory: realpathSync(resolve(packagePath, '..')),
  };
}

/** Throws when the package has an export map and the requested subpath is not part of it. */
export function validateSharedSubpath(
  packageInfo: InstalledPackageInfo,
  specifier: string,
): void {
  const exportMap = packageInfo.exports;

  if (!exportMap) return;

  const packageName = rootPackageName(specifier);
  const subpath = `.${specifier.slice(packageName.length)}`;
  const exportedSubpaths = exportMapSubpaths(exportMap);

  if (exportedSubpaths.some((key) => matchesExportKey(key, subpath))) return;

  throw federationConfigError(
    `Atlas could not resolve shared dependency entry "${specifier}".`,
    {
      suggestedActions: [
        `Import a subpath that "${packageName}" lists in its package.json "exports".`,
        'Or skip the specifier in the Atlas federation config so Vite bundles it instead of sharing it.',
      ],
      code: 'ATLAS_SHARED_ENTRY_NOT_EXPORTED',
    },
  );
}

function exportMapSubpaths(exportMap: unknown): string[] {
  const keys =
    typeof exportMap === 'object' &&
    exportMap !== null &&
    !Array.isArray(exportMap)
      ? Object.keys(exportMap).filter((key) => key.startsWith('.'))
      : [];

  return keys.length > 0 ? keys : ['.'];
}

function matchesExportKey(key: string, subpath: string): boolean {
  const wildcard = key.indexOf('*');

  if (wildcard < 0) return key === subpath;

  return (
    subpath.startsWith(key.slice(0, wildcard)) &&
    subpath.endsWith(key.slice(wildcard + 1)) &&
    subpath.length >= key.length - 1
  );
}
