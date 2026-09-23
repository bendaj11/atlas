import {
  anAppContext,
  anAppManifest,
} from '../../testkit/app-context.testkit.js';
import {
  createAtlasAppAssetFacade,
  createAtlasAppAssets,
  defineUnavailableAppAssets,
  type AtlasAppAssets,
} from './app-assets.js';

export class AppAssetsDriver {
  private facade!: AtlasAppAssets;

  readonly given = {
    remoteEntryUrl: (remoteEntryUrl: string) => {
      this.facade = createAtlasAppAssetFacade(
        {},
        anAppContext({ manifest: anAppManifest({ remoteEntryUrl }) }),
      );

      return this;
    },
    appAssetsWithoutSdk: (remoteEntryUrl: string) => {
      this.facade = createAtlasAppAssets(
        anAppContext({ manifest: anAppManifest({ remoteEntryUrl }) }),
      );

      return this;
    },
    noAppContext: () => {
      const facade: AtlasAppAssets = {
        assetBaseUrl: () => '',
        assetUrl: () => '',
      };
      defineUnavailableAppAssets(facade);
      this.facade = facade;

      return this;
    },
  };

  readonly get = {
    assets: () => this.facade,
  };
}
