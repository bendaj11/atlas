import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  useAppLoaded,
  useAtlasSdk,
  useAtlasStyleTarget,
  type AtlasSdk as ReactAtlasSdk,
} from '@atlas/sdk/react';
import { mockAtlasEnvironment } from '../atlas-environment/atlas-environment.js';
import type {
  MockAtlasEnvironment,
  MockAtlasEnvironmentOverrides,
} from '../atlas-environment/atlas-environment.types.js';
import { MockAtlasEnvironmentProvider } from './mock-atlas-environment-provider.js';

export interface CustomerHostSdk {
  hostData: { userName: string };
  greet(): string;
}

interface ProvidedAtlas {
  atlas: ReactAtlasSdk<CustomerHostSdk>;
  styleTarget: Node & ParentNode;
}

export class MockAtlasEnvironmentProviderDriver {
  private overrides: MockAtlasEnvironmentOverrides<CustomerHostSdk> = {};
  private environment!: MockAtlasEnvironment<CustomerHostSdk>;
  private hook!: RenderHookResult<ProvidedAtlas, undefined>;

  readonly given = {
    overrides: (overrides: MockAtlasEnvironmentOverrides<CustomerHostSdk>) => {
      this.overrides = overrides;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      this.hook = this.renderInEnvironment(() => ({
        atlas: useAtlasSdk<CustomerHostSdk>(),
        styleTarget: useAtlasStyleTarget(),
      }));
    },
    appLoadedRendered: () => {
      this.renderInEnvironment(() => useAppLoaded());
    },
    hostDataUpdated: (userName: string) =>
      act(() => this.environment.updateHostData({ userName })),
  };

  readonly get = {
    environment: () => this.environment,
    result: () => this.hook.result.current,
  };

  private renderInEnvironment<TResult>(useResult: () => TResult) {
    const environment = mockAtlasEnvironment(this.overrides);
    this.environment = environment;

    return renderHook(useResult, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MockAtlasEnvironmentProvider environment={environment}>
          {children}
        </MockAtlasEnvironmentProvider>
      ),
    });
  }
}
