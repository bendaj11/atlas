import type { AtlasAppContext } from './lifecycle.js';

export interface AtlasAppAssets {
  /** Returns published app artifact directory URL. */
  assetBaseUrl(): string;
  /** Resolves an app-public asset path within published app artifact. */
  assetUrl(path: string): string;
}

export function createAtlasAppAssetFacade<TSdk extends object>(
  sdk: TSdk,
  context: AtlasAppContext,
): TSdk & AtlasAppAssets {
  const assetBaseUrl = new URL('.', context.manifest.remoteEntryUrl).href;
  const facade = Object.create(sdk) as TSdk & AtlasAppAssets;
  Object.defineProperties(facade, {
    assetBaseUrl: { value: () => assetBaseUrl },
    assetUrl: { value: (path: string) => resolveAssetUrl(path, assetBaseUrl) },
  });
  return facade;
}

function resolveAssetUrl(path: string, assetBaseUrl: string): string {
  const assetUrl = new URL(path, assetBaseUrl);
  if (!assetUrl.href.startsWith(assetBaseUrl)) {
    throw new RangeError(
      `Atlas asset path "${path}" must stay within app artifact directory.`,
    );
  }
  return assetUrl.href;
}
