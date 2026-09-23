/** Host policy applied before Atlas downloads executable remote metadata. */
export interface AtlasRemoteTrustPolicy {
  allowedOrigins?: ReadonlySet<string>;
}

export type TrustedAssetKind = 'remote' | 'stylesheet';
