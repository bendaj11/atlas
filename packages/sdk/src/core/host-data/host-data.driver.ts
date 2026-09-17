import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createAtlasSdk } from '../sdk-factory/index.js';
import type { AtlasSdk } from '../sdk-types/index.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { subscribeAtlasHostData, updateAtlasHostData } from './host-data.js';

interface ProjectHostSdk {
  hostData: { projectId: string; userId: string | null };
}

export class HostDataDriver {
  private readonly listener = jest.fn<() => void>();
  private sdk!: AtlasSdk<ProjectHostSdk>;
  private unsubscribe: (() => void) | undefined;

  readonly given = {
    hostData: (hostData: ProjectHostSdk['hostData']): this => {
      this.sdk = createAtlasSdk<ProjectHostSdk>({
        hostId: faker.string.uuid(),
        navigation: aMemoryNavigation(),
        hostData,
      });

      return this;
    },
  };

  readonly when = {
    subscribed: (): void => {
      this.unsubscribe = subscribeAtlasHostData(this.sdk, this.listener);
    },
    unsubscribed: (): void => {
      this.unsubscribe?.();
    },
    hostDataUpdated: (updates: Partial<ProjectHostSdk['hostData']>): void => {
      updateAtlasHostData(this.sdk, updates);
    },
  };

  readonly get = {
    hostData: (): AtlasSdk<ProjectHostSdk>['hostData'] => this.sdk.hostData,
    listenerMock: (): jest.Mock<() => void> => this.listener,
  };
}
