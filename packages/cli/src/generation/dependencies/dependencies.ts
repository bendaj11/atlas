import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type SupportedFramework, doesPathExist } from '../../shared/index.js';

export interface FrameworkVersionInfo {
  version: string;
  manifest: string;
}

export async function detectExistingFrameworkVersion(
  root: string,
  workspaceRoot: string,
  framework: SupportedFramework,
): Promise<FrameworkVersionInfo | undefined> {
  try {
    const manifest = await resolveDependencyManifestPath(root, workspaceRoot);
    const packageJson = JSON.parse(
      await readFile(manifest, 'utf8'),
    ) as PackageJson;
    const dependency = framework === 'angular' ? '@angular/core' : 'react';

    for (const field of DEPENDENCY_FIELDS) {
      const version = toStringRecord(packageJson[field])[dependency];

      if (version) return { version, manifest };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function resolveDependencyManifestPath(
  projectRoot: string,
  workspaceRoot: string,
): Promise<string> {
  let current = projectRoot;
  const boundary = resolve(workspaceRoot);

  while (true) {
    const manifest = join(current, 'package.json');

    if (await doesPathExist(manifest)) return manifest;
    const parent = dirname(current);

    if (resolve(current) === boundary || parent === current) break;
    current = parent;
  }
  const workspaceManifest = join(workspaceRoot, 'package.json');

  if (await doesPathExist(workspaceManifest)) return workspaceManifest;
  throw new Error(
    `Could not find package.json for generated project at ${projectRoot}.`,
  );
}

export async function mergePackageDependencies(
  targetPackageJson: string,
  generatedPackageJson: string,
  framework: SupportedFramework,
): Promise<boolean> {
  const target = JSON.parse(
    await readFile(targetPackageJson, 'utf8'),
  ) as PackageJson;
  const generated = JSON.parse(generatedPackageJson) as PackageJson;
  const primaryDependency = resolveFrameworkPrimaryDependency(framework);
  const hasPrimaryDependency = isDependencyDeclared(target, primaryDependency);
  let changed = false;

  for (const field of DEPENDENCY_FIELDS) {
    const incoming = toStringRecord(generated[field]);

    if (!Object.keys(incoming).length) continue;

    for (const [name, version] of Object.entries(incoming)) {
      const existingField = resolveDependencyField(target, name);

      if (existingField) {
        if (
          hasPrimaryDependency &&
          isFrameworkManagedDependency(framework, name)
        ) {
          const existing = toStringRecord(target[existingField]);

          if (existing[name] !== version) {
            existing[name] = version;
            target[existingField] = sortRecordKeys(existing);
            changed = true;
          }
        }
        continue;
      }
      const current = toStringRecord(target[field]);
      current[name] = version;
      target[field] = current;
      changed = true;
    }
    target[field] = sortRecordKeys(toStringRecord(target[field]));
  }

  if (!changed) return false;
  await writeFile(
    targetPackageJson,
    `${JSON.stringify(target, null, 2)}\n`,
    'utf8',
  );

  return true;
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageJson = Record<string, unknown> &
  Partial<Record<DependencyField, unknown>>;

function isDependencyDeclared(packageJson: PackageJson, name: string): boolean {
  return resolveDependencyField(packageJson, name) !== undefined;
}

function resolveDependencyField(
  packageJson: PackageJson,
  name: string,
): DependencyField | undefined {
  return DEPENDENCY_FIELDS.find(
    (field) => name in toStringRecord(packageJson[field]),
  );
}

function resolveFrameworkPrimaryDependency(
  framework: SupportedFramework,
): string {
  return framework === 'angular' ? '@angular/core' : 'react';
}

function isFrameworkManagedDependency(
  framework: SupportedFramework,
  name: string,
): boolean {
  if (framework === 'angular') {
    return (
      name.startsWith('@angular/') ||
      name === '@angular-architects/native-federation' ||
      name === '@angular-architects/native-federation-v4' ||
      name === 'es-module-shims' ||
      name === 'typescript' ||
      name === 'zone.js'
    );
  }

  return (
    name === 'react' ||
    name === 'react-dom' ||
    name === '@types/react' ||
    name === '@types/react-dom' ||
    name === 'react-router-dom' ||
    name === 'react-compiler-runtime'
  );
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function sortRecordKeys(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}
