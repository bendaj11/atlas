import type { Scope } from '../../../types/columbus-state';
import {
  disabledLocalAppsKey,
  disabledOverridesKey,
  persistedOverridesKey,
  suppressedArtifactsKey,
} from './storage-keys';

export class StorageKeysDriver {
  private key: string | undefined;

  readonly when = {
    persistedOverridesKeyBuilt: (hostId: string): void => {
      this.key = persistedOverridesKey(hostId);
    },
    disabledLocalAppsKeyBuilt: (hostId: string): void => {
      this.key = disabledLocalAppsKey(hostId);
    },
    disabledOverridesKeyBuilt: (
      hostId: string,
      tabId: number,
      scope: Scope,
    ): void => {
      this.key = disabledOverridesKey(hostId, tabId, scope);
    },
    suppressedArtifactsKeyBuilt: (
      hostId: string,
      tabId: number,
      scope: Scope,
    ): void => {
      this.key = suppressedArtifactsKey(hostId, tabId, scope);
    },
  };

  readonly get = {
    key: (): string | undefined => this.key,
  };
}
