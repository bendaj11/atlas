import type { AtlasAppContext } from '../../lifecycle.js';
import { AtlasSdkError } from '../sdk-error/sdk-error.js';

export interface AtlasAppAssets {
  /** Returns published app artifact directory URL. */
  assetBaseUrl(): string;
  /** Resolves an app-public asset path within published app artifact. */
  assetUrl(path: string): string;
}

/** Resolves app assets before framework injection, including provider setup. */
export function createAtlasAppAssets(context: AtlasAppContext): AtlasAppAssets {
  return createAtlasAppAssetFacade({}, context);
}

export function createAtlasAppAssetFacade<TSdk extends object>(
  sdk: TSdk,
  context: AtlasAppContext,
): TSdk & AtlasAppAssets {
  const assetBaseUrl = new URL('.', context.manifest.remoteEntryUrl).href;
  const facade: TSdk & AtlasAppAssets = Object.create(sdk);
  Object.defineProperties(facade, {
    assetBaseUrl: { value: () => assetBaseUrl },
    assetUrl: {
      value: (path: string) =>
        resolveAssetUrlInsideArtifact(path, assetBaseUrl),
    },
  });

  return facade;
}

/** Makes `assetBaseUrl()`/`assetUrl()` explain that no app context is present (host-side SDK facades). */
export function defineUnavailableAppAssets(facade: object): void {
  Object.defineProperties(facade, {
    assetBaseUrl: { value: throwAppContextMissing },
    assetUrl: { value: throwAppContextMissing },
  });
}

function throwAppContextMissing(): never {
  throw new AtlasSdkError('App asset URLs require an Atlas app context.', {
    suggestedActions:
      'Call assetBaseUrl() or assetUrl() inside a mounted app. Hosts should use their own asset URLs.',
    code: 'ATLAS_APP_CONTEXT_MISSING',
  });
}

function resolveAssetUrlInsideArtifact(
  path: string,
  assetBaseUrl: string,
): string {
  const assetUrl = new URL(path, assetBaseUrl);

  if (!assetUrl.href.startsWith(assetBaseUrl)) {
    throw new AtlasSdkError(
      `Atlas asset path "${path}" must stay within the app artifact directory.`,
      {
        suggestedActions:
          'Pass a path relative to the app public directory, such as "images/logo.svg", without ".." segments or a different origin.',
        code: 'ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT',
      },
    );
  }

  return assetUrl.href;
}
