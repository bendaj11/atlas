import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createElement, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import type { AtlasAppContext } from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/sdk-factory.js';
import type { AtlasSdk as AtlasSdkValue } from '../../core/sdk-types/sdk-types.js';
import { updateAtlasHostData } from '../../core/host-data/host-data.js';
import { anAppContext } from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import {
  AtlasRuntimeContext,
  AtlasSdkProvider,
  AtlasStyleTargetContext,
  useAppLoaded,
  useAtlasSdk,
  useAtlasStyleTarget,
} from './react-context.js';

interface HostSdk {
  readonly hostData: { readonly userName: string };
}

function SdkConsumer() {
  const atlas = useAtlasSdk<HostSdk>();

  return createElement(
    'output',
    { 'aria-label': 'Host user' },
    atlas.hostData.userName,
  );
}

function StyleTargetConsumer({ expectedTarget }: { expectedTarget: Node }) {
  return createElement(
    'output',
    { 'aria-label': 'Atlas style target' },
    useAtlasStyleTarget() === expectedTarget ? 'available' : 'unexpected',
  );
}

function AppLoadedConsumer() {
  useAppLoaded();

  return null;
}

export class ReactContextDriver {
  private readonly styleTarget = document.createElement('div');
  private readonly sdk: AtlasSdkValue<HostSdk> = createAtlasSdk<HostSdk>({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
    hostData: { userName: faker.person.firstName() },
  });
  private readonly waitUntilReady = jest.fn<() => () => void>(
    () => () => undefined,
  );
  private context: AtlasAppContext | undefined = anAppContext({
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: this.waitUntilReady,
    },
  });

  readonly given = {
    userName: (userName: string): this => {
      updateAtlasHostData(this.sdk, { userName });

      return this;
    },
    appContext: (context: AtlasAppContext | undefined): this => {
      this.context = context;

      return this;
    },
  };

  readonly when = {
    sdkConsumerRendered: (): void => {
      render(this.withProviders(createElement(SdkConsumer)));
    },
    sdkConsumerRenderedWithoutProvider: (): void => {
      render(createElement(SdkConsumer));
    },
    styleTargetConsumerRendered: (): void => {
      render(
        createElement(
          AtlasStyleTargetContext.Provider,
          { value: this.styleTarget },
          createElement(StyleTargetConsumer, {
            expectedTarget: this.styleTarget,
          }),
        ),
      );
    },
    styleTargetConsumerRenderedWithoutProvider: (): void => {
      render(
        createElement(StyleTargetConsumer, {
          expectedTarget: this.styleTarget,
        }),
      );
    },
    appLoadedConsumerRendered: (): void => {
      render(this.withProviders(createElement(AppLoadedConsumer)));
    },
    hostUserRenamed: (userName: string): void => {
      updateAtlasHostData(this.sdk, { userName });
    },
  };

  readonly get = {
    hostUser: (): string | null =>
      screen.getByRole('status', { name: 'Host user' }).textContent,
    waitUntilReadyMock: (): jest.Mock<() => () => void> => this.waitUntilReady,
    styleTargetStatus: (): string | null =>
      screen.getByRole('status', { name: 'Atlas style target' }).textContent,
  };

  private withProviders(children: ReactNode): ReactNode {
    const runtime = this.context
      ? createElement(
          AtlasRuntimeContext.Provider,
          { value: this.context },
          children,
        )
      : children;

    return createElement(AtlasSdkProvider, {
      sdk: this.sdk,
      children: runtime,
    });
  }
}
