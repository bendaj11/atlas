import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import type { FederationSharedMetadata } from '../development-plugins/development-plugins.cjs';
import { federationConfigError } from '../federation-config-error/federation-config-error.cjs';
import {
  discoverRuntimePackageImports,
  isSourceFile,
  loadProjectTypescript,
  rootPackageName,
} from '../runtime-imports/runtime-imports.cjs';

export type SkipEntry = string | RegExp | ((specifier: string) => boolean);

export interface ReactSharedDependenciesOptions {
  readonly projectRoot: string;
  readonly skip?: readonly SkipEntry[];
}

export interface SharedDependency {
  readonly specifier: string;
  /** Rollup input name, `shared/<file>`. */
  readonly entryName: string;
  readonly packageDirectory: string;
  readonly metadata: FederationSharedMetadata;
  readonly devMetadata: FederationSharedMetadata;
}

interface PackageInfo {
  readonly version: string;
  readonly exports?: unknown;
  readonly directory: string;
}

interface ProjectPackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

const REACT_FRAMEWORK_SHARED_SPECIFIERS: Readonly<
  Record<string, readonly string[]>
> = {
  react: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  'react-dom': ['react-dom', 'react-dom/client'],
  '@atlas/sdk': [
    '@atlas/sdk',
    '@atlas/sdk/federation',
    '@atlas/sdk/host',
    '@atlas/sdk/lifecycle',
    '@atlas/sdk/navigation',
    '@atlas/sdk/react',
  ],
};

/** Resolves the packages a React remote shares with its host: framework packages plus every declared package the exposed entries import. */
export function reactSharedDependencies(
  options: ReactSharedDependenciesOptions,
  exposedEntryPoints: readonly string[],
): SharedDependency[] {
  const packagePath = join(options.projectRoot, 'package.json');
  const declared = declaredPackages(packagePath);
  const requireFromProject = createRequire(packagePath);
  const importedSpecifiers = discoverRuntimePackageImports({
    projectRoot: options.projectRoot,
    entryPoints: exposedEntryPoints,
    declared,
    typescript: loadProjectTypescript(requireFromProject),
  });
  const frameworkSpecifiers = Object.entries(
    REACT_FRAMEWORK_SHARED_SPECIFIERS,
  ).flatMap(([packageName, specifiers]) =>
    declared[packageName] ? specifiers : [],
  );
  const specifiers = [
    ...new Set([...frameworkSpecifiers, ...importedSpecifiers]),
  ]
    .filter((specifier) => !isSkippedDependency(specifier, options.skip))
    .sort();

  return specifiers.flatMap((specifier) => {
    const packageName = rootPackageName(specifier);
    const entryPoint = resolveSharedEntry(requireFromProject, specifier);
    if (entryPoint && !isSourceFile(entryPoint)) return [];
    const packageInfo = readPackageInfo(
      requireFromProject,
      packageName,
      specifier,
    );
    if (!entryPoint) validateSharedSubpath(packageInfo, specifier);
    const entryName = `shared/${sharedFileName(specifier)}`;
    const metadata = {
      packageName: specifier,
      requiredVersion: declared[packageName] || packageInfo.version,
      singleton: true,
      strictVersion: true,
      version: packageInfo.version,
    };

    return [
      {
        specifier,
        entryName,
        packageDirectory: packageInfo.directory,
        metadata: { ...metadata, outFileName: `${entryName}.js` },
        devMetadata: { ...metadata, outFileName: `@id/${specifier}` },
      },
    ];
  });
}

export function isSkippedDependency(
  specifier: string,
  skip: readonly SkipEntry[] = [],
): boolean {
  return skip.some((entry) => {
    if (typeof entry === 'string') return entry === specifier;
    if (typeof entry === 'function') return entry(specifier);
    entry.lastIndex = 0;

    return entry.test(specifier);
  });
}

function declaredPackages(packagePath: string): Record<string, string> {
  const packageJson: ProjectPackageJson = existsSync(packagePath)
    ? (JSON.parse(readFileSync(packagePath, 'utf8')) as ProjectPackageJson)
    : {};

  return { ...packageJson.dependencies, ...packageJson.peerDependencies };
}

function resolveSharedEntry(
  requireFromProject: NodeJS.Require,
  specifier: string,
): string | undefined {
  try {
    return requireFromProject.resolve(specifier);
  } catch {
    return undefined;
  }
}

function validateSharedSubpath(
  packageInfo: PackageInfo,
  specifier: string,
): void {
  const exportMap = packageInfo.exports;
  if (!exportMap) return;
  const subpath = `.${specifier.slice(rootPackageName(specifier).length)}`;
  const keys =
    typeof exportMap === 'object' && !Array.isArray(exportMap)
      ? Object.keys(exportMap).filter((key) => key.startsWith('.'))
      : [];
  const exportedSubpaths = keys.length > 0 ? keys : ['.'];
  const matches = exportedSubpaths.some((key) =>
    matchesExportKey(key, subpath),
  );
  if (!matches) {
    throw federationConfigError(
      `Atlas could not resolve shared dependency entry "${specifier}".`,
      {
        suggestedActions: [
          `Import a subpath that "${rootPackageName(specifier)}" lists in its package.json "exports".`,
          'Or skip the specifier in the Atlas federation config so Vite bundles it instead of sharing it.',
        ],
        code: 'ATLAS_SHARED_ENTRY_NOT_EXPORTED',
      },
    );
  }
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

function readPackageInfo(
  requireFromProject: NodeJS.Require,
  packageName: string,
  specifier: string,
): PackageInfo {
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

function sharedFileName(specifier: string): string {
  return specifier
    .replace(/^@/, '')
    .replaceAll('/', '__')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}
