import type { AtlasStaticRegistry } from '@atlas/schema';
import type { Sha256Digest } from '../../../shared/index.js';
import { createEmptyStaticRegistry } from '../static-registry.js';
import { assertStaticRegistry } from './static-registry-validation.js';

export class StaticRegistryValidationDriver {
  private readonly registry: AtlasStaticRegistry = createEmptyStaticRegistry();

  readonly given = {
    revision: (revision: Sha256Digest) => {
      this.registry.revision = revision;

      return this;
    },
  };

  readonly when = {
    validated: () => {
      assertStaticRegistry(this.registry);
    },
  };
}
