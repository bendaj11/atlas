import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppMountRequest } from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import type { CreateRoot, RenderRoot, UnmountRoot } from './react-app.types.js';

export interface RootAdapterMocks {
  readonly render: jest.Mock<RenderRoot>;
  readonly unmount: jest.Mock<UnmountRoot>;
  readonly createRoot: jest.Mock<CreateRoot>;
}

export function aRootAdapter(): RootAdapterMocks {
  const render = jest.fn<RenderRoot>();
  const unmount = jest.fn<UnmountRoot>();
  const createRoot = jest.fn<CreateRoot>(() => ({
    render,
    unmount,
  }));

  return { render, unmount, createRoot };
}

export function aMountRequest(): AtlasAppMountRequest {
  const container = document.createElement('div');

  return {
    container,
    styleTarget: container,
    sdk: createAtlasSdk({
      hostId: faker.string.uuid(),
      navigation: aMemoryNavigation(),
    }),
    context: anAppContext(),
  };
}
