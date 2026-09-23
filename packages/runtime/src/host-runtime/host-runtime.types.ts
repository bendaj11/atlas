import type { AtlasManifest, AtlasPlacement } from '@atlas/schema';
import type { AtlasHostDataOf, AtlasSdk } from '@atlas/sdk/host';
import type { AtlasWidgetLoader } from '@atlas/sdk/lifecycle';
import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';
import type { ImportAppRemote } from '../mount-app/mount-app.types.js';
import type {
  AtlasWidgetImporter,
  AtlasWidgetUiOptions,
} from '../widget-loader/widget-loader.types.js';

export interface AtlasMountedApp {
  manifest: AtlasManifest;
  unmount(): Promise<void>;
}

export type AtlasHostMountState =
  'mounting' | 'loading' | 'mounted' | 'error' | 'unmounted';

export interface AtlasHostMountEvent {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  container: HTMLElement;
  state: AtlasHostMountState;
  error?: Error;
}

export type ResolvePlacementContainer = (
  manifest: AtlasManifest,
  placement: AtlasPlacement,
) => HTMLElement | undefined;

export type AnchorsListener = () => void;

export type UnsubscribeListener = () => void;

export type SubscribeToAnchors = (
  listener: AnchorsListener,
) => UnsubscribeListener;

export type PublishActiveLayout = (layoutId: string | undefined) => void;

export type ReportMountStateChange = (event: AtlasHostMountEvent) => void;

export interface AtlasHostRuntimeOptions<
  THostSdk extends object = {},
> extends AtlasWidgetUiOptions {
  hostId: string;
  manifests: AtlasManifest[];
  sdk: AtlasSdk<THostSdk>;
  importRemote: ImportAppRemote;
  importWidget?: AtlasWidgetImporter;
  widgetLoader?: AtlasWidgetLoader;
  resolveRouteContainer: ResolvePlacementContainer;
  resolveSlotContainer: ResolvePlacementContainer;
  subscribeAnchors?: SubscribeToAnchors;
  /** Publishes the layout selected by the currently active route. */
  setActiveLayout?: PublishActiveLayout;
  onMountStateChange?: ReportMountStateChange;
  resourcesTimeoutMs?: number;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export type UpdateHostData<THostSdk extends object> = (
  updates: Partial<AtlasHostDataOf<THostSdk>>,
) => void;

export interface AtlasHostRuntime<THostSdk extends object = {}> {
  readonly hostId: string;
  readonly manifests: AtlasManifest[];
  retry(appId: string): Promise<void>;
  updateHostData: UpdateHostData<THostSdk>;
  stop(): Promise<void>;
}

export interface HostPlacement {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
}

export interface PlacementMountRecord {
  key: string;
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  container: HTMLElement;
  mounted?: AtlasMountedApp;
  pending?: Promise<void>;
  generation: number;
}

export interface RoutePlacementPlan {
  available: HostPlacement[];
  conflicts: HostPlacement[];
}

export interface RouteReconcileRequest {
  pathname: string;
  revision: number;
}

export interface RuntimeControllerInput {
  options: AtlasHostRuntimeOptions;
  widgetLoader: AtlasWidgetLoader;
  routePlacements: HostPlacement[];
  slotPlacements: HostPlacement[];
}

export type IsMountCurrent = () => boolean;

export interface AppReadiness {
  readonly requested: boolean;
  readonly ready: Promise<void>;
  request(): void;
  markReady(): void;
}

export interface LoadingStateEmitter {
  set(loading: boolean): void;
}
