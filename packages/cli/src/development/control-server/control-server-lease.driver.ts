import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import {
  CONTROL_RECONCILIATION_INTERVAL_MS,
  LEASE_LIFETIME_MS,
} from '../constants.js';
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
    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
      ],
      now: faker.date.recent(),
    });
  }

  readonly given = {
    lease: async (document: AtlasDevOverrideDocument, ready: boolean) => {
      await writeControlServerLease({ port: this.port, document, ready });
      this.documents.push(document);

      return this;
    },
    elapsed: (milliseconds: number) => {
      jest.setSystemTime(Date.now() + milliseconds);

      return this;
    },
  };

  readonly when = {
    removed: (document: AtlasDevOverrideDocument) =>
      removeControlServerLease({ port: this.port, document }),
  };

  readonly get = {
    activeLeases: () => readActiveControlServerLeases(this.port),
    leaseLifetime: () => LEASE_LIFETIME_MS,
    reconciliationInterval: () => CONTROL_RECONCILIATION_INTERVAL_MS,
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
