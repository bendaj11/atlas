import * as federationConfig from './federation-config.cjs';
import type { AngularFederationConfigOptions } from './federation-config.cjs';
export declare const createReactAppViteConfig: typeof federationConfig.createReactAppViteConfig, createReactHostViteConfig: typeof federationConfig.createReactHostViteConfig, createReactWidgetEntries: typeof federationConfig.createReactWidgetEntries, FederationConfigError: typeof federationConfig.FederationConfigError;
export type { AngularFederationConfigOptions, AngularFederationOptions, AngularProjectExpose, FederationConfigErrorOptions, ReactFederationConfigOptions, ReactWidgetEntriesOptions, ShareAll, SkipEntry, WidgetEntry, } from './federation-config.cjs';
export interface AngularV4FederationConfigOptions extends AngularFederationConfigOptions {
    /** Package that exposes the async `config` entry, for example `@angular-architects/native-federation`. */
    readonly nativeFederationPackage: string;
}
/** Native Federation config for `@angular-architects/native-federation` v21+ (ESM-only `config` entry). */
export declare function createAngularV4FederationConfig(options: AngularV4FederationConfigOptions): Promise<unknown>;
