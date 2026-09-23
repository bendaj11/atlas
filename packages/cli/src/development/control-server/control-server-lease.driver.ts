import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasDevOverrideDocument } from '../types.js';
import {
  readActiveControlServerLeases,
  removeControlServerLease,
  writeControlServerLease,
} from './control-server-lease.js';

export class ControlServerLeaseDriver {
  private readonly port = faker.number.int({ min: 40_000, max: 49_999 });
  private readonly documents: AtlasDevOverrideDocument[] = [];

  constructor() {
    jest.useFakeTimers({ now: faker.date.recent() });
  }

  readonly given = {
    lease: async (document: AtlasDevOverrideDocument, ready: boolean) => {
      await writeControlServerLease({ port: this.port, document, ready });
      this.documents.push(document);

      return this;
    },
  };

  readonly when = {
    removed: (document: AtlasDevOverrideDocument) =>
      removeControlServerLease({ port: this.port, document }),
    timeElapsed: (milliseconds: number) => {
      jest.setSystemTime(Date.now() + milliseconds);
    },
  };

  readonly get = {
    activeLeases: () => readActiveControlServerLeases(this.port),
    cleanup: async () => {
      try {
        for (const document of this.documents)
          await removeControlServerLease({ port: this.port, document });
      } finally {
        jest.useRealTimers();
      }
    },
  };
}
