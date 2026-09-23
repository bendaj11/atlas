import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createAtlasSdk } from '../sdk-factory/index.js';
import type { AtlasSdk } from '../sdk-types/index.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { subscribeAtlasHostData, updateAtlasHostData } from './host-data.js';

interface ProjectHostData {
  projectId: string;
  userId: string | null;
}

interface ProjectHostSdk {
  hostData: ProjectHostData;
}

export class HostDataDriver {
  private readonly listener = jest.fn<() => void>();
  private sdk!: AtlasSdk<ProjectHostSdk>;
  private unsubscribe: (() => void) | undefined;

  readonly given = {
    hostData: (hostData: ProjectHostData) => {
      this.sdk = createAtlasSdk<ProjectHostSdk>({
        hostId: faker.string.uuid(),
        navigation: aMemoryNavigation(),
        hostData,
      });

      return this;
    },
  };

  readonly when = {
    subscribed: () => {
      this.unsubscribe = subscribeAtlasHostData(this.sdk, this.listener);
    },
    unsubscribed: () => {
      this.unsubscribe?.();
    },
    hostDataUpdated: (updates: Partial<ProjectHostData>) => {
      updateAtlasHostData(this.sdk, updates);
    },
  };

  readonly get = {
    hostData: () => this.sdk.hostData,
    listenerMock: () => this.listener,
  };
}
