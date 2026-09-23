import { anAppManifest } from '@atlas/testkit';
import { createRemoteAssetResolver, rewriteCssUrls } from './asset-url.js';

export class AssetUrlDriver {
  private manifest = anAppManifest();
  private resolvedUrl = '';
  private rewrittenCss = '';

  readonly given = {
    manifestAt: (remoteEntryUrl: string) => {
      this.manifest = anAppManifest({ remoteEntryUrl });

      return this;
    },
  };

  readonly when = {
    resolvingUrl: (url: string) => {
      this.resolvedUrl = createRemoteAssetResolver(this.manifest)(url);
    },
    rewritingCss: (cssText: string) => {
      this.rewrittenCss = rewriteCssUrls(
        cssText,
        createRemoteAssetResolver(this.manifest),
      );
    },
  };

  readonly get = {
    resolvedUrl: () => this.resolvedUrl,
    rewrittenCss: () => this.rewrittenCss,
  };
}
