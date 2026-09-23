import type { AtlasManifest } from '@atlas/schema';
import type { AtlasEventMap, AtlasSdk } from '@atlas/sdk';
import type { AtlasWidgetLoader } from '@atlas/sdk/lifecycle';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import type {
  AtlasWidgetImporter,
  AtlasWidgetResolver,
} from '../widget-loader/widget-loader.types.js';
import type { DomHostOptions } from './dom-host.types.js';

export type DomHostSdk<THostSdk extends object> = AtlasSdk<
  THostSdk,
  AtlasEventMap
>;

export interface SdkProviderInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  hostId: string;
  navigation: AtlasNavigation;
  manifests: AtlasManifest[];
  importWidget: AtlasWidgetImporter;
  resolveWidget?: AtlasWidgetResolver;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface SdkProviders<THostSdk extends object> {
  sdk: DomHostSdk<THostSdk>;
  widgetLoader: AtlasWidgetLoader;
}

export interface DomHostSdkInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  hostId: string;
  navigation: AtlasNavigation;
}
