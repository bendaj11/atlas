import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppMountRequest } from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import type { RootAdapter } from './react-app.types.js';

export interface RootAdapterMocks {
  readonly render: jest.Mock<RootAdapter['render']>;
  readonly unmount: jest.Mock<RootAdapter['unmount']>;
  readonly createRoot: jest.Mock<(container: HTMLElement) => RootAdapter>;
}

export function aRootAdapter(): RootAdapterMocks {
  const render = jest.fn<RootAdapter['render']>();
  const unmount = jest.fn<RootAdapter['unmount']>();
  const createRoot = jest.fn<(container: HTMLElement) => RootAdapter>(() => ({
    render,
    unmount,
  }));

  return { render, unmount, createRoot };
}

export function aMountRequest(): AtlasAppMountRequest {
  const container = {} as HTMLElement;

  return {
    container,
    styleTarget: container as unknown as Node & ParentNode,
    sdk: createAtlasSdk({
      hostId: faker.string.uuid(),
      navigation: aMemoryNavigation(),
    }),
    context: anAppContext(),
  };
}
