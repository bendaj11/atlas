import { faker } from '@faker-js/faker';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import type { AtlasSdk as AtlasSdkValue } from '../../core/sdk-types/index.js';
import { updateAtlasHostData } from '../../core/host-data/host-data.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { AtlasSdkProvider } from './atlas-sdk-provider.js';
import { useAtlasSdk } from './use-atlas-sdk.js';

interface HostSdk {
  readonly hostData: { readonly userName: string };
}

const HOST_USER_LABEL = 'Host user';

function SdkConsumer() {
  const atlas = useAtlasSdk<HostSdk>();

  return createElement(
    'output',
    { 'aria-label': HOST_USER_LABEL },
    atlas.hostData.userName,
  );
}

export class UseAtlasSdkDriver {
  private readonly sdk: AtlasSdkValue<HostSdk> = createAtlasSdk<HostSdk>({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
    hostData: { userName: faker.person.firstName() },
  });

  readonly given = {
    userName: (userName: string) => {
      updateAtlasHostData(this.sdk, { userName });

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      render(
        createElement(AtlasSdkProvider, {
          sdk: this.sdk,
          children: createElement(SdkConsumer),
        }),
      );
    },
    renderedWithoutProvider: () => {
      render(createElement(SdkConsumer));
    },
    hostUserRenamed: (userName: string) => {
      updateAtlasHostData(this.sdk, { userName });
    },
  };

  readonly get = {
    hostUser: () =>
      screen.getByRole('status', { name: HOST_USER_LABEL }).textContent,
  };
}
