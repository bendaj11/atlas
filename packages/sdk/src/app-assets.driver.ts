import {
  createAtlasAppAssetFacade,
  type AtlasAppAssets,
} from './app-assets.js';
import { createAppContext } from './app-context.testkit.js';

export class AppAssetsDriver {
  private sdk: AtlasAppAssets | undefined;

  given = {
    appAt: (remoteEntryUrl: string): AppAssetsDriver => {
      this.sdk = createAtlasAppAssetFacade(
        {},
        createAppContext(remoteEntryUrl),
      );
      return this;
    },
  };

  get = {
    assetUrl: (path: string): string => this.getSdk().assetUrl(path),
    assetBaseUrl: (): string => this.getSdk().assetBaseUrl(),
  };

  private getSdk(): AtlasAppAssets {
    if (!this.sdk) throw new Error('SDK was not configured.');
    return this.sdk;
  }
}
