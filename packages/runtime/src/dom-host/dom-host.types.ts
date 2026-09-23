import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { AtlasEventMap, AtlasSdk, AtlasSdkOptions } from '@atlas/sdk';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import type { AtlasHostMountEvent } from '../host-runtime/host-runtime.types.js';
import type { AtlasFederationAdapter } from '../loader/native-federation.types.js';
import type { AtlasRuntimeObserver } from '../observability/observability.types.js';
import type {
  AtlasWidgetUiOptions,
  DisposeRenderer,
} from '../widget-loader/widget-loader.types.js';
import type { AtlasHostAnchorRegistry } from './host-anchors.js';
import type { AtlasHostNavigationItem } from './host-navigation.types.js';

export type RetryHostStart = () => void;

export type RetryPlacementMount = () => void;

export type ReportNavigationItems = (
  items: readonly AtlasHostNavigationItem[],
) => void;

export type RenderPlacementLoading = (
  container: HTMLElement,
  event: AtlasHostMountEvent,
) => void;

export type RenderPlacementError = (
  container: HTMLElement,
  event: AtlasHostMountEvent,
  retry: RetryPlacementMount,
) => void;

export type RenderHostLoading = (
  container: HTMLElement,
) => void | DisposeRenderer;

export type RenderHostError = (
  container: HTMLElement,
  error: Error,
  retry: RetryHostStart,
) => void | DisposeRenderer;

export interface DomRuntimeOptions extends AtlasWidgetUiOptions {
  federation: AtlasFederationAdapter;
  runtimeConfig: AtlasHostRuntimeConfig;
  /** Already-resolved catalog supplied by the stable Atlas loader. */
  catalog?: AtlasHostCatalog;
  document?: Document;
  /** Native Angular or React anchors used as Atlas render targets. */
  anchors?: AtlasHostAnchorRegistry;
  onNavigationChange?: ReportNavigationItems;
  renderLoading?: RenderPlacementLoading;
  renderError?: RenderPlacementError;
  renderHostLoading?: RenderHostLoading;
  renderHostError?: RenderHostError;
  /** Receives provider-neutral runtime diagnostics. Observer errors are ignored. */
  observe?: AtlasRuntimeObserver;
}

export type DomHostOptions<THostSdk extends object = {}> = Omit<
  AtlasSdkOptions<THostSdk, AtlasEventMap>,
  'hostId' | 'navigation'
> &
  DomRuntimeOptions & {
    sdk?: AtlasSdk<THostSdk, AtlasEventMap>;
    navigation?: AtlasNavigation;
  };

export type CreateHostNavigation = () =>
  AtlasNavigation | Promise<AtlasNavigation>;

export type PrepareNavigation = () => void | Promise<void>;

export type ReportSdkCreated<THostSdk extends object> = (
  sdk: AtlasSdk<THostSdk>,
) => void;

export interface DomHostServices<THostSdk extends object = {}> {
  createNavigation: CreateHostNavigation;
  beforeNavigation?: PrepareNavigation;
  onSdkCreated?: ReportSdkCreated<THostSdk>;
}

export interface DomHostRuntimeInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  services: DomHostServices<THostSdk>;
  document: Document;
  onInfrastructureReady: () => void;
}

export type MountStateRenderingOptions = Pick<
  DomRuntimeOptions,
  'renderError' | 'renderLoading'
>;

export interface HostMountStateRenderInput {
  document: Document;
  event: AtlasHostMountEvent;
  retry: RetryPlacementMount;
  options: MountStateRenderingOptions;
}

export interface HostNavigationRenderInput {
  document: Document;
  nav: HTMLElement | undefined;
  items: readonly AtlasHostNavigationItem[];
}
