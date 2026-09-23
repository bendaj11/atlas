import type { AtlasManifest } from '@atlas/schema';
import { isElement } from '../../shared/dom.js';
import {
  createRemoteAssetResolver,
  rewriteCssUrls,
} from '../asset-url/asset-url.js';
import type { AtlasAssetRewriteRelease } from '../remote-assets.types.js';
import {
  createDocumentStyleRewriteSession,
  registerDocumentStyleRewrite,
} from '../document-styles.js';
import {
  observeBoundaryAssets,
  patchBoundaryInsertion,
  rewriteAssetUrls,
} from '../element-assets.js';

export function startRemoteAssetRewrite(
  manifest: AtlasManifest,
  boundary: HTMLElement,
  document: Document | undefined = boundary.ownerDocument ??
    globalThis.document,
): AtlasAssetRewriteRelease {
  if (!isElement(boundary)) return () => undefined;

  const resolver = createRemoteAssetResolver(manifest);

  rewriteAssetUrls(boundary, resolver);

  const releaseInsertionRewrite = patchBoundaryInsertion(boundary, resolver);
  const releaseDocumentStyleRewrite = registerDocumentStyleRewrite(
    document,
    createDocumentStyleRewriteSession({
      appId: manifest.id,
      boundary,
      resolver,
    }),
  );
  const observer = observeBoundaryAssets(boundary, resolver);

  return () => {
    releaseInsertionRewrite();
    releaseDocumentStyleRewrite();
    observer?.disconnect();
  };
}

export function rewriteAssetUrl(
  value: string,
  manifest: AtlasManifest,
): string {
  return createRemoteAssetResolver(manifest)(value);
}

export function rewriteCssAssetUrls(
  cssText: string,
  manifest: AtlasManifest,
): string {
  return rewriteCssUrls(cssText, createRemoteAssetResolver(manifest));
}
