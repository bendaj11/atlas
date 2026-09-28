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

export interface AtlasHostMountErrorEvent extends AtlasHostMountEvent {
  error: Error;
}

export type RenderPlacementLoading = (
  status: HTMLElement,
  event: AtlasHostMountEvent,
) => DisposeRenderer;

export type RenderPlacementError = (
  status: HTMLElement,
  event: AtlasHostMountErrorEvent,
  retry: RetryPlacementMount,
) => DisposeRenderer;

export type RenderHostError = (
  status: HTMLElement,
  error: Error,
  retry: RetryHostStart,
) => DisposeRenderer;

export interface DomHostUiRenderers extends AtlasWidgetUiOptions {
  renderLoading?: RenderPlacementLoading;
  renderError?: RenderPlacementError;
  renderHostError?: RenderHostError;
}

export interface DomRuntimeOptions {
  federation: AtlasFederationAdapter;
  runtimeConfig: AtlasHostRuntimeConfig;
  /** Already-resolved catalog supplied by the stable Atlas loader. */
  catalog?: AtlasHostCatalog;
  document?: Document;
  /** Native Angular or React anchors used as Atlas render targets. */
  anchors?: AtlasHostAnchorRegistry;
  hostContainer?: HTMLElement;
  onNavigationChange?: ReportNavigationItems;
  /** Receives provider-neutral runtime diagnostics. Observer errors are ignored. */
  observe?: AtlasRuntimeObserver;
}

export type AtlasOwnedRuntimeOption =
  | 'federation'
  | 'runtimeConfig'
  | 'catalog'
  | 'document'
  | 'anchors'
  | 'hostContainer';

export type DomHostCustomizationOptions = Omit<
  DomRuntimeOptions,
  AtlasOwnedRuntimeOption
>;

export type DomSdkOptions<THostSdk extends object = {}> = Omit<
  AtlasSdkOptions<THostSdk, AtlasEventMap>,
  'hostId' | 'navigation'
>;

export type DomHostOptions<THostSdk extends object = {}> =
  DomSdkOptions<THostSdk> &
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
  onReady?: () => void;
  ui?: DomHostUiRenderers;
}

export interface DomHostRuntimeInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  services: DomHostServices<THostSdk>;
  document: Document;
  onInfrastructureReady: () => void;
  onPlacementStateChange?: () => void;
}

export interface HostMountStateRendererInput {
  document: Document;
  ui: DomHostUiRenderers;
}

export type RenderHostMountState = (
  event: AtlasHostMountEvent,
  retry: RetryPlacementMount,
) => void;

export interface HostNavigationRenderInput {
  document: Document;
  nav: HTMLElement | undefined;
  items: readonly AtlasHostNavigationItem[];
}
