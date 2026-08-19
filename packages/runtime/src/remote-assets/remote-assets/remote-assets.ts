import type { AtlasManifest } from '@atlas/schema';
import {
  createRemoteAssetResolver,
  rewriteCssUrls,
} from '../asset-url/asset-url.js';
import {
  createDocumentStyleRewriteSession,
  registerDocumentStyleRewrite,
} from '../document-styles.js';
import {
  observeBoundaryAssets,
  patchBoundaryInsertion,
  rewriteAssetUrls,
} from '../element-assets.js';

export type AtlasAssetRewriteRelease = () => void;

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
    createDocumentStyleRewriteSession(manifest.id, boundary, resolver),
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

function isElement(node: Node | EventTarget): node is Element {
  return typeof Element === 'undefined'
    ? 'getAttribute' in node && 'setAttribute' in node
    : node instanceof Element;
}
