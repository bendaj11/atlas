import {
  anAppContext,
  anAppManifest,
} from '../../testkit/app-context.testkit.js';
import {
  createAtlasAppAssetFacade,
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
  };

  readonly get = {
    assets: () => this.facade,
  };
}
