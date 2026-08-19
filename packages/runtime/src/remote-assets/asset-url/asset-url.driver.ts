import type { AtlasManifest } from '@atlas/schema';
import { createRemoteAssetResolver, rewriteCssUrls } from './asset-url.js';

export class AssetUrlDriver {
  private manifest: AtlasManifest | undefined;
  private resolvedUrl = '';
  private rewrittenCss = '';

  readonly given = {
    manifestAt: (remoteEntryUrl: string): AssetUrlDriver => {
      this.manifest = createManifest(remoteEntryUrl);
      return this;
    },
  };

  readonly when = {
    resolvingUrl: (url: string): AssetUrlDriver => {
      this.resolvedUrl = createRemoteAssetResolver(this.requireManifest())(url);
      return this;
    },
    rewritingCss: (cssText: string): AssetUrlDriver => {
      this.rewrittenCss = rewriteCssUrls(
        cssText,
        createRemoteAssetResolver(this.requireManifest()),
      );
      return this;
    },
  };

  readonly get = {
    resolvedUrl: (): string => this.resolvedUrl,
    rewrittenCss: (): string => this.rewrittenCss,
  };

  private requireManifest(): AtlasManifest {
    if (!this.manifest)
      throw new Error('Set remote entry URL before resolving assets.');
    return this.manifest;
  }
}

function createManifest(remoteEntryUrl: string): AtlasManifest {
  return {
    id: 'orders',
    name: 'orders',
    version: '1.0.0',
    schemaVersion: '1',
    kind: 'app',
    buildId: 'build',
    channel: 'production',
    framework: 'angular',
    isolation: 'shadow-dom',
    remoteEntryUrl,
    exposes: { entry: './entry' },
    requiredHostSdkVersion: '^1.0.0',
    supportedHosts: ['*'],
    placements: [],
    createdAt: '2026-08-11T00:00:00.000Z',
  };
}
