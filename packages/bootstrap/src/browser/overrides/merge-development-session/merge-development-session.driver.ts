import type { AtlasHostCatalog } from '@atlas/schema';
import { mergeDevelopmentSession } from './merge-development-session.js';
import type { DevSession } from '../overrides.types.js';

export class MergeDevelopmentSessionDriver {
  private result!: AtlasHostCatalog;

  readonly when = {
    merged: (input: {
      catalog: AtlasHostCatalog;
      session: DevSession;
    }): void => {
      this.result = mergeDevelopmentSession(input);
    },
  };

  readonly get = {
    result: (): AtlasHostCatalog => this.result,
  };
}
