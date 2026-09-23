import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type {
  AtlasAppMountRequest,
  AtlasAppMountResult,
} from '../../lifecycle.js';
import { defineApp } from './define-app.js';
import { aMountRequest, aRootAdapter } from './react-app.testkit.js';

export class DefineAppDriver {
  private readonly root = aRootAdapter();
  private readonly createElement = jest.fn<
    (request: AtlasAppMountRequest) => unknown
  >(() => faker.lorem.word());
  private readonly request = aMountRequest();
  private mounted: AtlasAppMountResult | void = undefined;

  readonly when = {
    mounted: async () => {
      this.mounted = await defineApp({
        createRoot: this.root.createRoot,
        createElement: this.createElement,
      }).mount(this.request);
    },
    unmounted: () => this.mounted?.unmount?.(),
  };

  readonly get = {
    createRootMock: () => this.root.createRoot,
    renderMock: () => this.root.render,
    unmountRootMock: () => this.root.unmount,
    createElementMock: (): jest.Mock<
      (request: AtlasAppMountRequest) => unknown
    > => this.createElement,
    request: () => this.request,
  };
}
