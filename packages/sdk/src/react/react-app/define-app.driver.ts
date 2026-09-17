import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasAppMountRequest,
  AtlasAppMountResult,
} from '../../lifecycle.js';
import { defineApp } from './define-app.js';
import { aMountRequest, aRootAdapter } from './react-app.testkit.js';
import type { RootAdapter } from './react-app.types.js';

export class DefineAppDriver {
  private readonly root = aRootAdapter();
  private readonly createElement = jest.fn<
    (request: AtlasAppMountRequest) => unknown
  >(() => faker.lorem.word());
  private readonly request = aMountRequest();
  private mounted: AtlasAppMountResult | void = undefined;

  readonly when = {
    mounted: async (): Promise<void> => {
      this.mounted = await defineApp({
        createRoot: this.root.createRoot,
        createElement: this.createElement,
      }).mount(this.request);
    },
    unmounted: async (): Promise<void> => {
      await this.mounted?.unmount?.();
    },
  };

  readonly get = {
    createRootMock: (): jest.Mock<(container: HTMLElement) => RootAdapter> =>
      this.root.createRoot,
    renderMock: (): jest.Mock<RootAdapter['render']> => this.root.render,
    unmountRootMock: (): jest.Mock<RootAdapter['unmount']> => this.root.unmount,
    createElementMock: (): jest.Mock<
      (request: AtlasAppMountRequest) => unknown
    > => this.createElement,
    request: (): AtlasAppMountRequest => this.request,
  };
}
