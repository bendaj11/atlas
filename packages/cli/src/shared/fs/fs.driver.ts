import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  doesPathExist,
  readJsonFile,
  readTextFile,
  writeJsonFile,
} from './fs.js';
import { TemporaryDirectory } from './fs.testkit.js';

export class FsDriver {
  private readonly temporaryDirectory = new TemporaryDirectory();
  private root = '';

  readonly given = {
    directory: async () => {
      this.root = await this.temporaryDirectory.create('atlas-fs-');

      return this;
    },
    file: async (name: string, contents: string) => {
      await writeFile(this.path(name), contents, 'utf8');

      return this;
    },
    subdirectory: async (name: string) => {
      await mkdir(this.path(name), { recursive: true });

      return this;
    },
  };

  readonly when = {
    jsonWritten: (name: string, value: unknown) =>
      writeJsonFile(this.path(name), value),
  };

  readonly get = {
    pathExists: (name: string) => doesPathExist(this.path(name)),
    text: (name: string) => readTextFile(this.path(name)),
    json: <T>(name: string) => readJsonFile<T>(this.path(name)),
    missingName: () => `${faker.string.alphanumeric(12)}.json`,
  };

  private path(name: string): string {
    return join(this.root, name);
  }
}
