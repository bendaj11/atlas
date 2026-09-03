import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasFramework } from '@atlas/schema';
import { warnWorkspaceDependencies } from './workspace-dependencies.js';

export class WorkspaceDependenciesDriver {
  private readonly projectRoot = join('/workspace/apps', faker.word.noun());
  private readonly packageName = `@${faker.word.noun()}/${faker.word.noun()}`;
  private readonly readFile = jest
    .fn<(path: string, encoding: 'utf8') => Promise<string>>()
    .mockResolvedValue('{}');
  private readonly warning = jest.fn<(message: string) => void>();

  given = {
    dependency: (version: unknown, group = 'dependencies'): void => {
      this.readFile.mockResolvedValue(
        JSON.stringify({
          [group]: { [this.packageName]: version },
        }),
      );
    },
    duplicateDependency: (version: string): void => {
      const dependencies = { [this.packageName]: version };
      this.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies,
          devDependencies: dependencies,
          peerDependencies: dependencies,
          optionalDependencies: dependencies,
        }),
      );
    },
    mixedDependencies: (version: string): void => {
      this.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            [this.packageName]: version,
            [faker.internet.domainWord()]: faker.system.semver(),
          },
        }),
      );
    },
    packageReadFailure: (code: string): void => {
      this.readFile.mockRejectedValue(
        Object.assign(new Error('Cannot read package.json'), { code }),
      );
    },
    invalidPackageJson: (source: string): void => {
      this.readFile.mockResolvedValue(source);
    },
  };

  when = {
    check: (framework: AtlasFramework = 'react'): Promise<void> =>
      warnWorkspaceDependencies(this.projectRoot, framework, {
        readFile: this.readFile,
        warning: this.warning,
      }),
  };

  get = {
    warnings: (): string[] =>
      this.warning.mock.calls.map(([message]) => message),
    message: (): string | undefined => this.warning.mock.calls[0]?.[0],
    summary: (): string | undefined =>
      this.warning.mock.calls[0]?.[0].split('\n')[0],
    packageName: (): string => this.packageName,
    packagePath: (): string => join(this.projectRoot, 'package.json'),
  };
}
