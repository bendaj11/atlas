import type { AtlasManifest } from '@atlas/schema';
import type { AtlasSdk } from '@atlas/sdk/host';
import type { AtlasAppEntry, AtlasWidgetLoader } from '@atlas/sdk/lifecycle';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import type {
  AtlasWidgetImporter,
  AtlasWidgetUiOptions,
} from '../widget-loader/widget-loader.types.js';

export type ImportAppRemote = (
  manifest: AtlasManifest,
) => Promise<AtlasAppEntry>;

export type ReleaseReadiness = () => void;

export type RequestReadiness = () => ReleaseReadiness;

export type ReportLoadingChange = (loading: boolean) => void;

export interface AtlasLoaderOptions extends AtlasWidgetUiOptions {
  hostId: string;
  sdk: AtlasSdk;
  importRemote?: ImportAppRemote;
  importWidget?: AtlasWidgetImporter;
  widgetLoader?: AtlasWidgetLoader;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasMountAppOptions extends AtlasLoaderOptions {
  manifest: AtlasManifest;
  container: HTMLElement;
  path?: string;
  routeTitle?: string;
  onReady?: ReleaseReadiness;
  onReadyRequested?: RequestReadiness;
  onLoadingChange?: ReportLoadingChange;
}

export interface RouteTitleController {
  set(title: string): void;
  reset(): void;
}
