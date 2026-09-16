import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import {
  AtlasRuntimeContext,
  AtlasSdkProvider,
  useAtlasSdk,
} from '../../src/react/react-context/react-context.js';
import { createAtlasSdk, updateAtlasHostData } from '../../src/index.js';
import {
  anAppContext,
  anAppManifest,
} from '../../src/testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../src/testkit/navigation.testkit.js';

interface HostSdk {
  readonly hostData: { readonly userName: string };
  showMessage(message: string): void;
}

function HostFixture({ message }: { message: string }) {
  const atlas = useAtlasSdk<HostSdk>();
  const [assetResult, setAssetResult] = useState('');

  function readAsset(kind: 'base' | 'file'): void {
    try {
      setAssetResult(
        kind === 'base' ? atlas.assetBaseUrl() : atlas.assetUrl('logo.svg'),
      );
    } catch (error) {
      setAssetResult(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <p role="status" aria-label="Host ID">
        {atlas.hostId}
      </p>
      <p role="status" aria-label="Host user">
        {atlas.hostData.userName}
      </p>
      <button onClick={() => atlas.showMessage(message)}>Send message</button>
      <button onClick={() => readAsset('base')}>Read asset base</button>
      <button onClick={() => readAsset('file')}>Read asset URL</button>
      <output aria-label="Asset result">{assetResult}</output>
    </>
  );
}

export class ReactHostDriver {
  private readonly user = userEvent.setup();
  private readonly message = faker.lorem.sentence();
  private readonly initialName = faker.person.firstName();
  private readonly updatedName = faker.person.firstName();
  private readonly showMessage = jest.fn<(message: string) => void>();
  private readonly sdk = createAtlasSdk<HostSdk>({
    hostId: faker.string.uuid(),
    hostData: { userName: this.initialName },
    navigation: aMemoryNavigation(),
    showMessage: this.showMessage,
  });

  readonly when = {
    renderHost: (): void => {
      render(
        <AtlasSdkProvider sdk={this.sdk}>
          <HostFixture message={this.message} />
        </AtlasSdkProvider>,
      );
    },
    renderApp: (remoteEntryUrl: string): void => {
      render(
        <AtlasSdkProvider sdk={this.sdk}>
          <AtlasRuntimeContext.Provider
            value={anAppContext({
              manifest: anAppManifest({ remoteEntryUrl }),
            })}
          >
            <HostFixture message={this.message} />
          </AtlasRuntimeContext.Provider>
        </AtlasSdkProvider>,
      );
    },
    updateHostData: async (): Promise<void> => {
      await act(async () =>
        updateAtlasHostData(this.sdk, { userName: this.updatedName }),
      );
    },
    sendMessage: async (): Promise<void> => {
      await this.user.click(
        screen.getByRole('button', { name: 'Send message' }),
      );
    },
    readAssetBase: async (): Promise<void> => {
      await this.user.click(
        screen.getByRole('button', { name: 'Read asset base' }),
      );
    },
    readAssetUrl: async (): Promise<void> => {
      await this.user.click(
        screen.getByRole('button', { name: 'Read asset URL' }),
      );
    },
    cleanup: (): void => cleanup(),
  };

  readonly get = {
    renderedHostId: (): string | null =>
      screen.getByRole('status', { name: 'Host ID' }).textContent,
    hostId: (): string => this.sdk.hostId,
    messageHandler: () => this.showMessage,
    message: (): string => this.message,
    assetResult: (): string | null =>
      screen.getByLabelText('Asset result').textContent,
    updatedHostName: async (): Promise<string | null> =>
      waitFor(() => {
        const name = screen.getByRole('status', {
          name: 'Host user',
        }).textContent;
        if (name !== this.updatedName)
          throw new Error('Host data has not updated');
        return name;
      }),
    updatedName: (): string => this.updatedName,
  };
}
