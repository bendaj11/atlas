import type { AtlasHostRuntimeConfig, AtlasManifest } from '@atlas/schema';
import {
  isHttpProtocol,
  isLoopbackHostname,
  resolveUrlAgainstDocument,
} from '../../shared/url.js';
import { AtlasRemoteTrustError } from '../loader.errors.js';
import type {
  AtlasRemoteTrustPolicy,
  TrustedAssetKind,
} from './trust-policy.types.js';

export const PERMISSIVE_TRUST_POLICY: AtlasRemoteTrustPolicy = {};

/** Builds the default fail-closed policy from deployment configuration. */
export function createRemoteTrustPolicy(
  config: AtlasHostRuntimeConfig,
): AtlasRemoteTrustPolicy {
  const origins = [
    config.artifactRegistryUrl,
    config.environmentRegistryUrl ?? config.artifactRegistryUrl,
  ].map((value) => resolveUrlAgainstDocument(value).origin);

  return { allowedOrigins: new Set(origins) };
}

export function assertManifestAssetTrust(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = PERMISSIVE_TRUST_POLICY,
): void {
  if (manifest.channel === 'local') {
    assertLocalManifestUsesLoopbackUrls(manifest);

    return;
  }

  assertAssetUrlIsTrusted({
    urlValue: manifest.remoteEntryUrl,
    appId: manifest.id,
    kind: 'remote',
    policy,
  });

  assertManifestStylesTrust(manifest, policy);
}

export function assertManifestStylesTrust(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = PERMISSIVE_TRUST_POLICY,
): void {
  if (manifest.channel === 'local') {
    assertLocalManifestUsesLoopbackUrls(manifest);

    return;
  }

  for (const stylesheet of manifest.styles ?? []) {
    assertAssetUrlIsTrusted({
      urlValue: stylesheet.href,
      appId: manifest.id,
      kind: 'stylesheet',
      policy,
    });
  }
}

export function assertLocalManifestUsesLoopbackUrls(
  manifest: AtlasManifest,
): void {
  if (manifest.channel !== 'local') return;

  const urls = [
    manifest.remoteEntryUrl,
    ...(manifest.styles ?? []).map(({ href }) => href),
    ...(manifest.exportedWidgets ?? []).map(
      ({ remoteEntryUrl }) => remoteEntryUrl,
    ),
  ];

  for (const value of urls) {
    const url = resolveUrlAgainstDocument(value);

    if (!isHttpProtocol(url.protocol) || !isLoopbackHostname(url.hostname)) {
      throw new AtlasRemoteTrustError(
        `Atlas local app "${manifest.id}" uses non-loopback asset URL "${url.href}".`,
      );
    }
  }
}

function assertAssetUrlIsTrusted(input: {
  urlValue: string;
  appId: string;
  kind: TrustedAssetKind;
  policy: AtlasRemoteTrustPolicy;
}): void {
  const url = resolveUrlAgainstDocument(input.urlValue);

  if (!isHttpProtocol(url.protocol)) {
    throw new AtlasRemoteTrustError(
      `Atlas app "${input.appId}" uses unsupported ${input.kind} protocol "${url.protocol}".`,
    );
  }

  if (
    input.policy.allowedOrigins &&
    !input.policy.allowedOrigins.has(url.origin)
  ) {
    throw new AtlasRemoteTrustError(
      `Atlas app "${input.appId}" uses ${input.kind} origin "${url.origin}", which is not allowed by the host runtime configuration.`,
    );
  }
}
