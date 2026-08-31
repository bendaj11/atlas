import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { versionPackages } from './version-packages.js';

const packageDirectories = [
  'schema',
  'sdk',
  'runtime',
  'bootstrap',
  'generators',
  'testkit',
  'cli',
];

export class VersionPackagesDriver {
  private root = '';

  readonly given = {
    releaseWorkspace: async (version: string): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-version-'));
      await writeJson(join(this.root, 'package.json'), {
        name: 'atlas-platform',
        version,
      });
      for (const directory of packageDirectories) {
        await writeJson(
          join(this.root, 'packages', directory, 'package.json'),
          {
            name: `@atlas/${directory}`,
            version,
            dependencies: {
              '@atlas/schema': 'workspace:^',
              external: '^1.0.0',
            },
          },
        );
      }
      await writeJson(join(this.root, 'apps/columbus/package.json'), {
        name: '@atlas/columbus',
        version,
      });
      await writeJson(join(this.root, 'apps/columbus/src/manifest.json'), {
        manifest_version: 3,
        version,
      });
      await writeFileInDirectory(
        join(this.root, 'packages/generators/src/cli/generator-versions.ts'),
        `export const ATLAS_PACKAGE_VERSION = "${version}";\n`,
      );
    },
  };

  readonly when = {
    versionAtlasPackages: async (version: string): Promise<void> =>
      versionPackages(version, this.root),
  };

  readonly get = {
    atlasVersions: async (): Promise<string[]> =>
      uniqueVersions([
        readVersion(join(this.root, 'package.json')),
        ...packageDirectories.map((directory) =>
          readVersion(join(this.root, 'packages', directory, 'package.json')),
        ),
        readGeneratorVersion(
          join(this.root, 'packages/generators/src/cli/generator-versions.ts'),
        ),
      ]),
    columbusVersions: async (): Promise<string[]> =>
      uniqueVersions([
        readVersion(join(this.root, 'apps/columbus/package.json')),
        readVersion(join(this.root, 'apps/columbus/src/manifest.json')),
      ]),
    internalDependencyVersions: async (): Promise<string[]> =>
      uniqueVersions(
        packageDirectories.map((directory) =>
          readDependencyVersion(
            join(this.root, 'packages', directory, 'package.json'),
            '@atlas/schema',
          ),
        ),
      ),
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileInDirectory(path, `${JSON.stringify(value)}\n`);
}

async function writeFileInDirectory(
  path: string,
  contents: string,
): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, contents);
}

async function readVersion(path: string): Promise<string> {
  const manifest: { version: string } = JSON.parse(
    await readFile(path, 'utf8'),
  );
  return manifest.version;
}

async function readGeneratorVersion(path: string): Promise<string> {
  const source = await readFile(path, 'utf8');
  return source.match(/ATLAS_PACKAGE_VERSION = "([^"']+)"/)?.[1] ?? '';
}

async function readDependencyVersion(
  path: string,
  dependencyName: string,
): Promise<string> {
  const manifest: { dependencies: Record<string, string> } = JSON.parse(
    await readFile(path, 'utf8'),
  );
  return manifest.dependencies[dependencyName];
}

async function uniqueVersions(versions: Promise<string>[]): Promise<string[]> {
  return [...new Set(await Promise.all(versions))];
}
