import { createAtlasSdk } from './sdk-factory.js';
import type { AtlasNavigation } from './navigation-types.js';
import { createAppContext } from './app-context.testkit.js';
import { createReactAtlasSdk, type ReactAtlasSdk } from './react-widget.js';

export class ReactWidgetDriver {
  private sdk: ReactAtlasSdk | undefined;

  given = {
    appAt: (remoteEntryUrl: string): ReactWidgetDriver => {
      this.sdk = createReactAtlasSdk(
        createAtlasSdk({ hostId: 'host', navigation: createNavigation() }),
        createAppContext(remoteEntryUrl),
      );
      return this;
    },
  };

  get = {
    assetUrl: (path: string): string => this.getSdk().assetUrl(path),
  };

  private getSdk(): ReactAtlasSdk {
    if (!this.sdk) throw new Error('SDK was not configured.');
    return this.sdk;
  }
}

function createNavigation(): AtlasNavigation {
  return {
    navigate: () => undefined,
    replace: () => undefined,
    back: () => undefined,
    createHref: (path) => path,
    subscribe: () => () => undefined,
    getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
  };
}
