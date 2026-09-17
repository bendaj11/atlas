export interface FederationExposeMetadata {
  readonly key: string;
  readonly outFileName: string;
}

export interface FederationSharedMetadata {
  readonly packageName: string;
  readonly outFileName: string;
  readonly requiredVersion: string;
  readonly singleton: boolean;
  readonly strictVersion: boolean;
  readonly version: string;
}

export interface FederationMetadata {
  readonly name: string;
  readonly exposes: readonly FederationExposeMetadata[];
  readonly shared: readonly FederationSharedMetadata[];
}
