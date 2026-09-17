import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import {
  doesPathExist,
  readJsonFile,
  readTextFile,
  writeJsonFile,
} from './fs.js';

export class FsDriver {
  private root = '';

  readonly given = {
    directory: async (): Promise<this> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-fs-'));

      return this;
    },
    file: async (name: string, contents: string): Promise<this> => {
      await writeFile(this.path(name), contents, 'utf8');

      return this;
    },
    subdirectory: async (name: string): Promise<this> => {
      await mkdir(this.path(name), { recursive: true });

      return this;
    },
  };

  readonly when = {
    jsonWritten: async (name: string, value: unknown): Promise<void> => {
      await writeJsonFile(this.path(name), value);
    },
  };

  readonly get = {
    pathExists: (name: string): Promise<boolean> =>
      doesPathExist(this.path(name)),
    text: (name: string): Promise<string | undefined> =>
      readTextFile(this.path(name)),
    json: <T>(name: string): Promise<T | undefined> =>
      readJsonFile<T>(this.path(name)),
    missingName: (): string => `${faker.string.alphanumeric(12)}.json`,
  };

  private path(name: string): string {
    return join(this.root, name);
  }
}
