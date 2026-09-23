import type { AtlasManifest } from '@atlas/schema';
import { resolveUrlAgainstDocument } from '../../shared/url.js';
import type { AssetResolver } from '../remote-assets.types.js';

const ASSET_PATH_TOKEN = 'assets/';
const ASSET_PATH_PATTERN = /^(?:\.\/)?assets\//;
const ABSOLUTE_ASSET_PATH_PATTERN = /^\/assets\//;
const URL_FUNCTION_PATTERN = /url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/g;

export function createRemoteAssetResolver(
  manifest: AtlasManifest,
): AssetResolver {
  const remoteEntryUrl = resolveUrlAgainstDocument(manifest.remoteEntryUrl);
  const remoteDirectory = new URL('.', remoteEntryUrl);
  return (value) => {
    const trimmedValue = value.trim();

    if (
      hasSchemeOrIsProtocolRelative(trimmedValue) ||
      isFragmentUrl(trimmedValue)
    )
      return value;

    if (ABSOLUTE_ASSET_PATH_PATTERN.test(trimmedValue))
      return new URL(trimmedValue.slice(1), remoteDirectory).href;

    if (ASSET_PATH_PATTERN.test(trimmedValue))
      return new URL(trimmedValue.replace(/^\.\//, ''), remoteDirectory).href;
    return value;
  };
}

export function rewriteCssUrls(
  cssText: string,
  resolver: AssetResolver,
): string {
  if (!cssText.includes(ASSET_PATH_TOKEN)) return cssText;
  return cssText.replace(
    URL_FUNCTION_PATTERN,
    (
      _match,
      quote: string | undefined,
      quotedValue: string | undefined,
      unquotedValue: string | undefined,
    ) => {
      const rawValue = quotedValue ?? unquotedValue ?? '';
      const rewrittenValue = resolver(rawValue);
      const delimiter = quote ?? '';
      return `url(${delimiter}${rewrittenValue}${delimiter})`;
    },
  );
}

function hasSchemeOrIsProtocolRelative(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith('//');
}

function isFragmentUrl(value: string): boolean {
  return value.startsWith('#');
}
