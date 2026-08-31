import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageDirectories = [
  'schema',
  'sdk',
  'runtime',
  'bootstrap',
  'generators',
  'testkit',
  'cli',
];

export async function versionPackages(
  version: string,
  workspaceRoot: string = root,
): Promise<void> {
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Usage: pnpm release <major.minor.patch[-prerelease]>');
  }

  const manifestPaths = [
    join(workspaceRoot, 'package.json'),
    ...packageDirectories.map((directory) =>
      join(workspaceRoot, 'packages', directory, 'package.json'),
    ),
  ];
  for (const path of manifestPaths) {
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.version = version;
    for (const [name, dependencyVersion] of Object.entries(
      manifest.dependencies ?? {},
    )) {
      if (
        name.startsWith('@atlas/') &&
        typeof dependencyVersion === 'string' &&
        !dependencyVersion.startsWith('workspace:') &&
        dependencyVersion !== version
      )
        manifest.dependencies[name] = version;
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  const generatorVersionsPath = join(
    workspaceRoot,
    'packages/generators/src/cli/generator-versions.ts',
  );
  const generatorVersions = await readFile(generatorVersionsPath, 'utf8');
  const versionDeclaration = /ATLAS_PACKAGE_VERSION = (["'])[^"']+\1/;
  if (!versionDeclaration.test(generatorVersions)) {
    throw new Error('Atlas generator version declaration was not found.');
  }
  await writeFile(
    generatorVersionsPath,
    generatorVersions.replace(
      versionDeclaration,
      `ATLAS_PACKAGE_VERSION = "${version}"`,
    ),
    'utf8',
  );

  console.info(
    `Updated the workspace, ${packageDirectories.length} Atlas packages, and generator output to ${version}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await versionPackages(process.argv[2]);
}
