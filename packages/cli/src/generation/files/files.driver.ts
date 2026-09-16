import { jest } from '@jest/globals';
import {
  ensureAtlasGeneratedFilesIgnored,
  type IgnoreFileDependencies,
} from './files.js';

export class GeneratedFilesDriver {
  private readonly readIgnore = jest.fn<IgnoreFileDependencies['readIgnore']>();
  private readonly writeIgnore = jest
    .fn<IgnoreFileDependencies['writeIgnore']>()
    .mockResolvedValue(undefined);

  readonly given = {
    ignoreFile: (contents: string | undefined): this => {
      if (contents === undefined)
        this.readIgnore.mockRejectedValue(
          Object.assign(new Error('missing'), { code: 'ENOENT' }),
        );
      else this.readIgnore.mockResolvedValue(contents);

      return this;
    },
  };

  readonly when = {
    ignored: (workspaceRoot: string, projectRoot: string): Promise<void> =>
      ensureAtlasGeneratedFilesIgnored(workspaceRoot, projectRoot, {
        readIgnore: this.readIgnore,
        writeIgnore: this.writeIgnore,
      }),
  };

  readonly get = {
    writeIgnoreMock: () => this.writeIgnore,
  };
}
