import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtlasFramework } from '@atlas/schema';
import { ui } from '../../cli/ui/ui.js';

interface WorkspaceDependencyChecks {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  warning(message: string): void;
}

interface PackageDependencies {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}

const SKIP_CONFIG_LOCATIONS: Partial<Record<AtlasFramework, string>> = {
  angular:
    "the Atlas federation options in this project's federation.config.js or federation.config.mjs",
  react:
    "the createReactAppViteConfig or createReactHostViteConfig options in this project's vite.config.ts",
};

export async function warnWorkspaceDependencies(
  projectRoot: string,
  framework: AtlasFramework,
  checks: WorkspaceDependencyChecks = { readFile, warning: ui.warning },
): Promise<void> {
  const configLocation = SKIP_CONFIG_LOCATIONS[framework];
  if (!configLocation) return;

  const packagePath = join(projectRoot, 'package.json');
  const packageJson = await readPackageDependencies(packagePath, checks);
  if (!packageJson) return;

  const packageNames = workspaceDependencyNames(packageJson);
  if (packageNames.length === 0) return;

  checks.warning(
    [
      `Local workspace dependencies detected in ${packagePath}: ${packageNames.join(', ')}.`,
      `For packages you edit locally and import at runtime, ensure "skip" in ${configLocation} covers their names and imported subpaths. This lets the framework bundle local code instead of loading a shared federation copy that may hide your changes.`,
      'Restart atlas dev after changing this configuration. If a package exports compiled files, run its build watcher too. Keep packages that require a shared singleton out of "skip".',
    ].join('\n'),
  );
}

async function readPackageDependencies(
  packagePath: string,
  checks: WorkspaceDependencyChecks,
): Promise<PackageDependencies | undefined> {
  try {
    return JSON.parse(
      await checks.readFile(packagePath, 'utf8'),
    ) as PackageDependencies;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function workspaceDependencyNames(packageJson: PackageDependencies): string[] {
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  return [
    ...new Set(
      dependencyGroups.flatMap((dependencies) =>
        Object.entries(dependencies ?? {})
          .filter(
            ([, version]) =>
              typeof version === 'string' &&
              version.trim().startsWith('workspace:'),
          )
          .map(([name]) => name),
      ),
    ),
  ].sort();
}
