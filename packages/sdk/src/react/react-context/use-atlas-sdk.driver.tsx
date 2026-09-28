import { faker } from '@faker-js/faker';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import type { AtlasSdk as AtlasSdkValue } from '../../core/sdk-types/index.js';
import { updateAtlasHostData } from '../../core/host-data/host-data.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { AtlasSdkProvider } from './atlas-sdk-provider.js';
import { useAtlasSdk, type AtlasSdk } from './use-atlas-sdk.js';

interface HostSdk {
  readonly hostData: { readonly userName: string };
}

const HOST_USER_LABEL = 'Host user';

type ReceiveSdk = (atlas: AtlasSdk<HostSdk>) => void;

interface SdkConsumerProps {
  readonly onSdk: ReceiveSdk;
}

function SdkConsumer({ onSdk }: SdkConsumerProps) {
  const atlas = useAtlasSdk<HostSdk>();
  onSdk(atlas);

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
  private atlas!: AtlasSdk<HostSdk>;
  private readonly receiveSdk: ReceiveSdk = (atlas) => {
    this.atlas = atlas;
  };

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
          children: createElement(SdkConsumer, { onSdk: this.receiveSdk }),
        }),
      );
    },
    renderedWithoutProvider: () => {
      render(createElement(SdkConsumer, { onSdk: this.receiveSdk }));
    },
    hostUserRenamed: (userName: string) => {
      updateAtlasHostData(this.sdk, { userName });
    },
    hostDataUpdatedThroughSdkFacade: (userName: string) => {
      updateAtlasHostData(this.atlas, { userName });
    },
  };

  readonly get = {
    hostUser: () =>
      screen.getByRole('status', { name: HOST_USER_LABEL }).textContent,
  };
}
