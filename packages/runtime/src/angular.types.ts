import type { ApplicationConfig, Injector, Signal, Type } from '@angular/core';
import type { AtlasHostConfig } from '@atlas/schema';
import type { AtlasSdk } from '@atlas/sdk';
import type { LocationLike, RouterLike } from '@atlas/sdk/angular';
import type { AtlasHostDataOf } from '@atlas/sdk/host';
import type { AtlasHostMountRequest } from '@atlas/sdk/lifecycle';
import type {
  DomHostCustomizationOptions,
  DomHostOptions,
  DomRuntimeOptions,
} from './dom-host/dom-host.types.js';

export type AngularHostDataInput<THostSdk extends object> = {
  [Key in keyof AtlasHostDataOf<THostSdk>]:
    AtlasHostDataOf<THostSdk>[Key] | Signal<AtlasHostDataOf<THostSdk>[Key]>;
};

type AngularHostDataOption<THostSdk extends object> =
  keyof AtlasHostDataOf<THostSdk> extends never
    ? { hostData?: AngularHostDataInput<THostSdk> }
    : { hostData: AngularHostDataInput<THostSdk> };

/** Product SDK configuration supplied by `src/app/host.config.ts`. */
export type HostSdkOptions<THostSdk extends object = {}> = Omit<
  DomHostOptions<THostSdk>,
  keyof DomRuntimeOptions | 'hostData'
> &
  DomHostCustomizationOptions &
  AngularHostDataOption<THostSdk>;

export type HostOptions<THostSdk extends object = {}> =
  HostSdkOptions<THostSdk> &
    DomRuntimeOptions & {
      router: RouterLike;
      location: LocationLike;
      /** Injector used by Atlas to dispose Signal-backed host data with the host runtime. */
      hostDataInjector?: Injector;
    };

export type CreateHostOptions<THostSdk extends object> = (
  injector: Injector,
) => HostOptions<THostSdk>;

export interface AngularHostBootstrapOptions<THostSdk extends object = {}> {
  component: Type<unknown>;
  appConfig: ApplicationConfig;
  request?: AtlasHostMountRequest;
  createHostOptions: CreateHostOptions<THostSdk>;
}

export type CreateAngularHostSdkOptions<THostSdk extends object> = (
  injector: Injector,
) => HostSdkOptions<THostSdk>;

export interface AngularHostDefinition<THostSdk extends object = {}> {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  component: Type<unknown>;
  appConfig?: ApplicationConfig;
  sdkOptions: CreateAngularHostSdkOptions<THostSdk>;
}

export type ReportAngularSdkCreated<THostSdk extends object> = (
  sdk: AtlasSdk<THostSdk>,
) => void;

export interface AngularHostStartServices<THostSdk extends object> {
  onSdkCreated?: ReportAngularSdkCreated<THostSdk>;
}

export interface MountedAngularHost {
  unmount(): Promise<void>;
}
