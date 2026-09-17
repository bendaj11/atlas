import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { FederationSharedMetadata } from '../development-plugins/index.cjs';
import {
  discoverRuntimePackageImports,
  isSourceFile,
  loadProjectTypescript,
  rootPackageName,
} from '../runtime-imports/index.cjs';
import {
  declaredPackages,
  readPackageInfo,
  resolveSharedEntry,
  validateSharedSubpath,
} from './package-info.cjs';
import { isSkippedDependency, type SkipEntry } from './skip-entries.cjs';

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

  return specifiers.flatMap((specifier) =>
    sharedDependencyOf({ specifier, declared, requireFromProject }),
  );
}

function sharedDependencyOf(request: {
  readonly specifier: string;
  readonly declared: Readonly<Record<string, string>>;
  readonly requireFromProject: NodeJS.Require;
}): SharedDependency[] {
  const { specifier, declared, requireFromProject } = request;
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
}

function sharedFileName(specifier: string): string {
  return specifier
    .replace(/^@/, '')
    .replaceAll('/', '__')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}
