export type AngularProjectExpose = 'host' | 'app';

export interface AngularFederationConfigOptions {
  readonly projectRoot: string;
  /** Native Federation remote name. */
  readonly name: string;
  /** Selects the Atlas entries to expose: `./host` for a host, `./entry` plus widgets for an app. */
  readonly expose?: AngularProjectExpose;
  readonly exposes?: Readonly<Record<string, string>>;
  readonly shared?: Readonly<Record<string, unknown>>;
  readonly skip?: readonly string[];
  /** Any further option is forwarded to `withNativeFederation` untouched. */
  readonly [nativeFederationOption: string]: unknown;
}

export interface AngularFederationOptions {
  readonly name: string;
  readonly exposes: Readonly<Record<string, string>>;
  readonly shared: Readonly<Record<string, unknown>>;
  readonly skip: readonly string[];
  readonly [nativeFederationOption: string]: unknown;
}

export interface SharedDependencyOptions {
  readonly singleton: boolean;
  readonly strictVersion: boolean;
  readonly requiredVersion: string;
}

export type ShareAll = (
  config: SharedDependencyOptions,
  options: {
    readonly projectPath: string;
    readonly overrides: Readonly<Record<string, unknown>>;
  },
) => Readonly<Record<string, unknown>>;

export interface NativeFederationConfigModule {
  readonly shareAll: ShareAll;
  readonly withNativeFederation: (options: AngularFederationOptions) => unknown;
}
