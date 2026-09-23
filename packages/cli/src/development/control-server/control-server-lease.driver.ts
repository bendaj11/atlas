import { basename, dirname } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasDevOverrideDocument } from '../types.js';

const files = new Map<string, string>();

jest.unstable_mockModule('node:fs/promises', () => ({
  mkdir: async () => undefined,
  writeFile: async (path: string, contents: string) => {
    files.set(path, contents);
  },
  readFile: async (path: string) => {
    const contents = files.get(path);

    if (contents === undefined) throw new Error(`ENOENT: ${path}`);

    return contents;
  },
  readdir: async (directory: string) =>
    [...files.keys()]
      .filter((path) => dirname(path) === directory)
      .map((path) => basename(path)),
  rm: async (path: string) => {
    files.delete(path);
  },
}));

const {
  readActiveControlServerLeases,
  removeControlServerLease,
  writeControlServerLease,
} = await import('./control-server-lease.js');

export class ControlServerLeaseDriver {
  private readonly port = faker.number.int({ min: 1, max: 65_535 });

  constructor() {
    files.clear();
    jest.useFakeTimers({ now: faker.date.recent() });
  }

  readonly given = {
    lease: async (document: AtlasDevOverrideDocument, ready: boolean) => {
      await writeControlServerLease({ port: this.port, document, ready });

      return this;
    },
  };

  readonly when = {
    removed: (document: AtlasDevOverrideDocument) =>
      removeControlServerLease({ port: this.port, document }),
    timeElapsed: (milliseconds: number) => {
      jest.setSystemTime(Date.now() + milliseconds);
    },
    clockRestored: () => {
      jest.useRealTimers();
    },
  };

  readonly get = {
    activeLeases: () => readActiveControlServerLeases(this.port),
  };
}
