import { relative } from 'node:path';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  dependencyManifestPath,
  existingFrameworkVersionInfo,
  mergePackageDependencies,
  type FrameworkVersionInfo,
} from './dependencies.js';
import { type SupportedFramework, readJsonFile } from '../../shared/index.js';

export class DependenciesDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-dependencies-');

      return this;
    },
    packageJson: async (
      relativePath: string,
      value: unknown,
    ): Promise<this> => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
    directory: async (relativePath: string): Promise<this> => {
      await this.directory.mkdir(relativePath);

      return this;
    },
  };

  readonly when = {
    merged: (
      relativeManifest: string,
      generated: unknown,
      framework: SupportedFramework,
    ): Promise<boolean> =>
      mergePackageDependencies(
        this.directory.path(relativeManifest),
        JSON.stringify(generated),
        framework,
      ),
  };

  readonly get = {
    manifestPath: async (relativeProjectRoot: string): Promise<string> =>
      relative(
        this.directory.root,
        await dependencyManifestPath(
          this.directory.path(relativeProjectRoot),
          this.directory.root,
        ),
      ),
    frameworkVersion: async (
      relativeProjectRoot: string,
      framework: SupportedFramework,
    ): Promise<FrameworkVersionInfo | undefined> => {
      const info = await existingFrameworkVersionInfo(
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
