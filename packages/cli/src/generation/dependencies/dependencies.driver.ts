import { relative } from 'node:path';
import type { SupportedFramework } from '../../shared/index.js';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const {
  resolveDependencyManifestPath,
  detectExistingFrameworkVersion,
  mergePackageDependencies,
} = await import('./dependencies.js');
const { readJsonFile } = await import('../../shared/index.js');

export class DependenciesDriver {
  private readonly directory = new InMemoryDirectory();

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-dependencies-');

      return this;
    },
    packageJson: async (relativePath: string, value: unknown) => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
    directory: async (relativePath: string) => {
      await this.directory.mkdir(relativePath);

      return this;
    },
  };

  readonly when = {
    merged: (
      relativeManifest: string,
      generated: unknown,
      framework: SupportedFramework,
    ) =>
      mergePackageDependencies(
        this.directory.path(relativeManifest),
        JSON.stringify(generated),
        framework,
      ),
  };

  readonly get = {
    manifestPath: async (relativeProjectRoot: string) =>
      relative(
        this.directory.root,
        await resolveDependencyManifestPath(
          this.directory.path(relativeProjectRoot),
          this.directory.root,
        ),
      ),
    frameworkVersion: async (
      relativeProjectRoot: string,
      framework: SupportedFramework,
    ) => {
      const info = await detectExistingFrameworkVersion(
        this.directory.path(relativeProjectRoot),
        this.directory.root,
        framework,
      );

      return info
        ? { ...info, manifest: relative(this.directory.root, info.manifest) }
        : undefined;
    },
    packageJson: (relativePath: string) =>
      readJsonFile<Record<string, unknown>>(this.directory.path(relativePath)),
  };
}
