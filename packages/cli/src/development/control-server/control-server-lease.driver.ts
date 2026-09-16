import { faker } from '@faker-js/faker';
import type { AtlasDevOverrideDocument } from '../types.js';
import {
  readActiveControlServerLeases,
  removeControlServerLease,
  writeControlServerLease,
} from './control-server-lease.js';

export class ControlServerLeaseDriver {
  private readonly port = faker.number.int({ min: 40_000, max: 49_999 });
  private readonly documents: AtlasDevOverrideDocument[] = [];

  readonly given = {
    lease: async (
      document: AtlasDevOverrideDocument,
      ready: boolean,
    ): Promise<this> => {
      await writeControlServerLease({ port: this.port, document, ready });
      this.documents.push(document);

      return this;
    },
  };

  readonly when = {
    removed: (document: AtlasDevOverrideDocument): Promise<void> =>
      removeControlServerLease({ port: this.port, document }),
  };

  readonly get = {
    activeLeases: () => readActiveControlServerLeases(this.port),
    cleanup: async (): Promise<void> => {
      for (const document of this.documents)
        await removeControlServerLease({ port: this.port, document });
    },
  };
}
