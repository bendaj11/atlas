import type { Scope } from '../../../types/app';
import {
  disabledLocalAppsKey,
  disabledOverridesKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from './storage-keys';

export class StorageKeysDriver {
  private key: string | undefined;

  readonly when = {
    persistedOverridesKeyBuilt: (hostId: string): this => {
      this.key = persistedOverridesKey(hostId);

      return this;
    },
    disabledLocalAppsKeyBuilt: (hostId: string): this => {
      this.key = disabledLocalAppsKey(hostId);

      return this;
    },
    disabledOverridesKeyBuilt: (
      hostId: string,
      tabId: number,
      scope: Scope,
    ): this => {
      this.key = disabledOverridesKey(hostId, tabId, scope);

      return this;
    },
    suppressedArtifactsKeyBuilt: (
      hostId: string,
      tabId: number,
      scope: Scope,
    ): this => {
      this.key = suppressedArtifactsKey(hostId, tabId, scope);

      return this;
    },
  };

  readonly get = {
    key: (): string | undefined => this.key,
  };
}
