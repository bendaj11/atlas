import type { AtlasManifest } from '@atlas/schema';
import { anAppManifest } from '@atlas/testkit';
import type { AtlasAssetRewriteRelease } from '../remote-assets.types.js';
import {
  rewriteAssetUrl,
  rewriteCssAssetUrls,
  startRemoteAssetRewrite,
} from './remote-assets.js';

interface MountedAppSession {
  manifest: AtlasManifest;
  boundary: HTMLElement;
  release: AtlasAssetRewriteRelease;
}

export class RemoteAssetsDriver {
  private readonly document = document.implementation.createHTMLDocument();
  private readonly sessionsByAppId = new Map<string, MountedAppSession>();
  private readonly addedStyles: HTMLStyleElement[] = [];
  private lastManifest: AtlasManifest | undefined;
  private appendedImage: HTMLImageElement | undefined;
  private rewrittenAssetUrl = '';
  private rewrittenCss = '';

  readonly given = {
    appAt: (appId: string, remoteEntryUrl: string) => {
      const manifest = anAppManifest({
        id: appId,
        remoteEntryUrl,
        isolation: 'shadow-dom',
      });
      const boundary = this.document.body
        .appendChild(this.document.createElement('div'))
        .attachShadow({ mode: 'open' })
        .appendChild(this.document.createElement('div'));
      this.lastManifest = manifest;
      this.sessionsByAppId.set(appId, {
        manifest,
        boundary,
        release: startRemoteAssetRewrite(manifest, boundary, this.document),
      });

      return this;
    },
  };

  readonly when = {
    documentStyleAdded: (cssText: string) => {
      this.document.head.appendChild(this.createStyle(cssText));
    },
    documentFragmentWithStyleAdded: (cssText: string) => {
      const fragment = this.document.createDocumentFragment();

      fragment.appendChild(this.createStyle(cssText));
      this.document.head.appendChild(fragment);
    },
    boundaryStyleAdded: (appId: string, cssText: string) => {
      this.sessionsByAppId
        .get(appId)!
        .boundary.appendChild(this.createStyle(cssText));
    },
    boundaryImageAppended: (appId: string, src: string) => {
      const wrapper = this.document.createElement('div');
      this.appendedImage = this.document.createElement('img');

      this.appendedImage.setAttribute('src', src);
      wrapper.append(this.appendedImage);
      this.sessionsByAppId.get(appId)!.boundary.append(wrapper);
    },
    appUnmounted: (appId: string) => this.sessionsByAppId.get(appId)!.release(),
    rewritingAssetUrl: (assetUrl: string) => {
      this.rewrittenAssetUrl = rewriteAssetUrl(assetUrl, this.lastManifest!);
    },
    rewritingCss: (cssText: string) => {
      this.rewrittenCss = rewriteCssAssetUrls(cssText, this.lastManifest!);
    },
  };

  readonly get = {
    shadowStyleTexts: (appId: string) =>
      [...this.sessionsByAppId.get(appId)!.boundary.getRootNode().childNodes]
        .filter((node): node is HTMLStyleElement => node.nodeName === 'STYLE')
        .map((style) => style.textContent ?? ''),
    boundaryChildAppend: (appId: string) =>
      this.sessionsByAppId.get(appId)!.boundary.firstElementChild?.append,
    addedStyleTexts: () =>
      this.addedStyles.map((style) => style.textContent ?? ''),
    appendedImageSrc: () => this.appendedImage!.getAttribute('src'),
    rewrittenAssetUrl: () => this.rewrittenAssetUrl,
    rewrittenCss: () => this.rewrittenCss,
  };

  private createStyle(cssText: string): HTMLStyleElement {
    const style = this.document.createElement('style');
    style.textContent = cssText;

    this.addedStyles.push(style);

    return style;
  }
}
