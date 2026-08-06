import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { join } from 'node:path';
import {
  ensureAtlasGeneratedFilesIgnored,
  type IgnoreFileDependencies,
} from './files.js';

type IgnoreScenario = 'existing' | 'outside' | 'workspace';

export class GeneratedFilesDriver {
  private readonly workspaceRoot = `/workspace/${faker.string.alphanumeric(10)}`;
  private readonly outsideRoot = `/external/${faker.string.alphanumeric(10)}`;
  private readonly projectName = faker.word.noun();
  private readonly readIgnore = jest.fn<IgnoreFileDependencies['readIgnore']>();
  private readonly writeIgnore =
    jest.fn<IgnoreFileDependencies['writeIgnore']>();
  private projectRoot = '';

  readonly given = {
    ignoreFile: (scenario: IgnoreScenario): void => {
      this.projectRoot =
        scenario === 'outside'
          ? this.outsideRoot
          : join(this.workspaceRoot, 'apps', this.projectName);

      if (scenario === 'existing') {
        this.readIgnore.mockResolvedValue('dist/\n.atlas\n');
      } else {
        this.readIgnore.mockRejectedValue(
          Object.assign(new Error(faker.lorem.sentence()), { code: 'ENOENT' }),
        );
      }

      this.writeIgnore.mockResolvedValue();
    },
  };

  readonly when = {
    ensureIgnored: async (): Promise<void> => {
      await ensureAtlasGeneratedFilesIgnored(
        this.workspaceRoot,
        this.projectRoot,
        {
          readIgnore: this.readIgnore,
          writeIgnore: this.writeIgnore,
        },
      );
    },
  };

  readonly get = {
    writtenFile: (): { path: string; contents: string } | undefined => {
      const call = this.writeIgnore.mock.calls[0];

      return call ? { path: call[0], contents: call[1] } : undefined;
    },
    workspaceIgnoreFile: (): { path: string; contents: string } => ({
      path: join(this.workspaceRoot, '.gitignore'),
      contents: '.atlas/\n',
    }),
    projectIgnoreFile: (): { path: string; contents: string } => ({
      path: join(this.projectRoot, '.gitignore'),
      contents: '.atlas/\n',
    }),
  };
}
